import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MAX_EXCERPTS = 12;
const MIN_LENGTH = 50;
const MAX_LENGTH = 180;

// En-têtes/pieds de page et liens, fréquents dans le texte extrait d'un PDF.
const NOISE = /\bpage \d+\b|https?:\/\/|www\./i;

/** Première phrase lisible d'un chunk, raccourcie si besoin. */
function firstSentence(content: string): string | null {
  const sentence = content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    // Écarte aussi les titres de section collés au texte ("5.4 Claude in
    // Chrome Certains outils…") : phrase commençant par un chiffre ou une puce,
    // ou finissant par " ." comme un intitulé.
    .find((s) => s.trim().length >= MIN_LENGTH && !NOISE.test(s) && !/^[\d•]/.test(s.trim()) && !/\s[.!?]$/.test(s.trim()))
    ?.trim();
  if (!sentence) return null;
  return sentence.length <= MAX_LENGTH ? sentence : `${sentence.slice(0, MAX_LENGTH).replace(/\s+\S*$/, "")}…`;
}

// GET /api/org/formations/[id]/excerpts — quelques phrases réparties sur
// l'ensemble des documents source, affichées pendant les attentes de
// génération (components/authoring/WaitingPanel.tsx) pour montrer que l'IA
// travaille bien sur le contenu du Formateur. Purement illustratif : ce ne
// sont pas les passages réellement lus à cet instant.
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const [{ data: sources }, { data: chunks }] = await Promise.all([
    supabase.from("knowledge_sources").select("id, file_name").eq("formation_id", formationId).eq("ingestion_status", "terminee"),
    supabase
      .from("chunks")
      .select("knowledge_source_id, content, metadata")
      .eq("formation_id", formationId)
      .not("knowledge_source_id", "is", null)
      .limit(1000),
  ]);

  const names = new Map((sources ?? []).map((s) => [s.id, s.file_name as string]));
  const bySource = new Map<string, { content: string; position: number }[]>();
  for (const chunk of chunks ?? []) {
    if (!names.has(chunk.knowledge_source_id)) continue;
    const list = bySource.get(chunk.knowledge_source_id) ?? [];
    list.push({ content: chunk.content, position: (chunk.metadata as { position?: number } | null)?.position ?? 0 });
    bySource.set(chunk.knowledge_source_id, list);
  }

  const perSource = Math.max(2, Math.ceil(MAX_EXCERPTS / Math.max(1, bySource.size)));
  const excerpts: { text: string; source: string; positionPct: number }[] = [];
  for (const [sourceId, list] of bySource) {
    list.sort((a, b) => a.position - b.position);
    for (let i = 0; i < perSource; i++) {
      const index = Math.floor(((i + 0.5) / perSource) * list.length);
      const text = firstSentence(list[index].content);
      if (text) excerpts.push({ text, source: names.get(sourceId)!, positionPct: Math.round((index / list.length) * 100) });
    }
  }

  return NextResponse.json({ data: excerpts.slice(0, MAX_EXCERPTS) });
}
