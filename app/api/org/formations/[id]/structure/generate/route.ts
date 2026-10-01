import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canAuthorFormationByAi } from "@/lib/subscription";
import { generateStructureProposal, type CadrageInput } from "@/lib/ai/generateStructureProposal";
import { loadSourceDocumentsText } from "@/lib/sourceDocumentsText";
import { consumeFormationAi, quotaRefusalMessage } from "@/lib/aiGenerationQuota";

export const dynamic = "force-dynamic";
// Génération par le modèle le plus capable (OPENAI_GENERATION_MODEL) sur le
// texte complet des documents : mesuré à ~85 s pour un PDF de 60 pages, et
// jusqu'à 3 tentatives en cas de sortie invalide.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/structure/generate — génère (ou régénère) la
// proposition de structure à partir du cadrage + du texte COMPLET des documents
// de la formation, reconstitué dans l'ordre (pas une recherche vectorielle
// ciblée : on veut une vue d'ensemble, voir Point 4 de l'architecture
// validée). Écrase tout brouillon existant non encore validé.
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }
  if (!(await canAuthorFormationByAi(guard.tenantId))) {
    return NextResponse.json(
      { error: "La génération de formation par IA nécessite l'offre Création ou Entreprise.", code: "plan_upgrade_required" },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("formation_structure")
    .select("validated_at")
    .eq("formation_id", formationId)
    .maybeSingle();
  if (existing?.validated_at) {
    return NextResponse.json({ error: "Cette structure a déjà été validée." }, { status: 409 });
  }

  const { data: cadrage } = await supabase.from("formation_cadrage").select("*").eq("formation_id", formationId).maybeSingle();
  if (!cadrage?.completed_at) {
    return NextResponse.json({ error: "Le cadrage de cette formation n'a pas encore été validé." }, { status: 400 });
  }

  let sourceText: string;
  try {
    ({ text: sourceText } = await loadSourceDocumentsText(supabase, formationId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lecture des documents impossible." }, { status: 500 });
  }
  if (!sourceText) {
    return NextResponse.json({ error: "Aucun document indexé pour cette formation." }, { status: 400 });
  }

  const cadrageInput: CadrageInput = {
    objectif: cadrage.objectif,
    publicVise: cadrage.public_vise,
    niveau: cadrage.niveau,
    nbModulesSouhaite: cadrage.nb_modules_souhaite,
    dureeEstimee: cadrage.duree_estimee,
    notionsAInclure: cadrage.notions_a_inclure ?? [],
    notionsAExclure: cadrage.notions_a_exclure ?? [],
  };

  // Première génération de structure = la formation est comptée dans le quota
  // mensuel de formations IA du tenant (ensuite, tout est inclus).
  const quotaResult = await consumeFormationAi(guard.tenantId, formationId);
  if (!quotaResult.allowed) {
    return NextResponse.json({ error: quotaRefusalMessage(quotaResult), code: "quota_exceeded" }, { status: 403 });
  }

  // Réponse en streaming (NDJSON, une ligne JSON par événement) pour afficher
  // le plan au fil de son écriture — la génération complète prend ~1 min 30
  // sur un document de 60 pages, le premier module arrive après ~6 s :
  //   { type: "delta", text }      morceau du JSON produit par le modèle
  //   { type: "retry", attempt }   sortie invalide, régénération : jeter le texte reçu
  //   { type: "done", data }       structure validée et enregistrée (ligne formation_structure)
  //   { type: "error", error }     échec définitif
  // Les erreurs de contrôle ci-dessus restent des réponses JSON classiques.
  // Si le navigateur se déconnecte en cours de route, la génération continue
  // et la structure est quand même enregistrée.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };

      try {
        const proposal = await generateStructureProposal(cadrageInput, sourceText, {
          onDelta: (text) => send({ type: "delta", text }),
          onRetry: (attempt) => send({ type: "retry", attempt }),
        });

        const { data, error } = await supabase
          .from("formation_structure")
          .upsert(
            { formation_id: formationId, proposal, updated_at: new Date().toISOString() },
            { onConflict: "formation_id" }
          )
          .select()
          .single();

        if (error) send({ type: "error", error: error.message });
        else send({ type: "done", data });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Erreur inconnue lors de la génération." });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
