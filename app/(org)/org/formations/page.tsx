import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ClipboardList, Layers, PenSquare, CheckCircle2, Plus } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi, hasActiveSubscription } from "@/lib/subscription";
import UpgradeNotice from "./UpgradeNotice";
import FormationsListClient, { type FormationListItem } from "./FormationsListClient";
import styles from "./formations.module.css";

type Stage = "cadrage" | "structure" | "generation" | "published";

const STAGE_INFO: Record<Stage, { label: string; icon: typeof ClipboardList; href: (id: string) => string }> = {
  cadrage: { label: "Documents source / cadrage à compléter", icon: ClipboardList, href: (id) => `/org/formations/${id}/cadrage` },
  structure: { label: "Structure à générer/valider", icon: Layers, href: (id) => `/org/formations/${id}/structure` },
  generation: { label: "Génération de contenu en cours", icon: PenSquare, href: (id) => `/org/formations/${id}/generation` },
  published: { label: "Publiée", icon: CheckCircle2, href: (id) => `/org/formations/${id}/generation` },
};

// Page fusionnée "Catalogue Ahead" + "Mes formations" : avant, une formation
// créée par ce tenant via l'IA n'apparaissait jamais dans /org/catalogue (qui
// ne montre que les formations du super_admin, tenant_id IS NULL) — ce qui
// donnait l'impression qu'elle avait disparu. Les deux sources sont
// maintenant réunies ici, distinguées par un badge et un filtre (voir
// FormationsListClient), chacune gardant ses propres actions : créer/modifier/
// supprimer pour les formations du tenant, activer/désactiver + voir le
// contenu pour le catalogue Ahead.
export default async function FormationsPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  const { data: currentUser } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (!currentUser?.tenant_id || currentUser.role !== "admin_tenant") {
    redirect("/org");
  }
  const tenantId = currentUser.tenant_id;

  const [eligible, subscribed] = await Promise.all([
    canCreateFormationByAi(tenantId),
    hasActiveSubscription(tenantId),
  ]);

  // ── Formations créées par ce tenant (assistant IA) ──
  const { data: ownFormations } = await supabase
    .from("formations")
    .select("id, title, is_published, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const ownIds = (ownFormations ?? []).map((f) => f.id);
  const [{ data: cadrages }, { data: structures }] = await Promise.all([
    ownIds.length > 0
      ? supabase.from("formation_cadrage").select("formation_id, completed_at").in("formation_id", ownIds)
      : { data: [] as { formation_id: string; completed_at: string | null }[] },
    ownIds.length > 0
      ? supabase.from("formation_structure").select("formation_id, validated_at").in("formation_id", ownIds)
      : { data: [] as { formation_id: string; validated_at: string | null }[] },
  ]);
  const cadrageDone = new Set((cadrages ?? []).filter((c) => c.completed_at).map((c) => c.formation_id));
  const structureDone = new Set((structures ?? []).filter((s) => s.validated_at).map((s) => s.formation_id));

  // /cadrage redirige lui-même vers /sources si aucun document n'est encore
  // prêt — donc pas besoin de distinguer "aucune source" de "cadrage pas
  // validé" ici, renvoyer vers /cadrage couvre les deux cas correctement.
  function stageFor(f: { id: string; is_published: boolean }): Stage {
    if (f.is_published) return "published";
    if (structureDone.has(f.id)) return "generation";
    if (cadrageDone.has(f.id)) return "structure";
    return "cadrage";
  }

  const ownItems: FormationListItem[] = eligible
    ? (ownFormations ?? []).map((f) => {
        const stage = stageFor(f);
        const info = STAGE_INFO[stage];
        return {
          source: "own",
          id: f.id,
          title: f.title,
          createdAt: f.created_at,
          href: info.href(f.id),
          stageLabel: info.label,
          stageIcon: <info.icon size={13} />,
          isPublished: f.is_published,
          isFinal: stage === "published",
          canPreview: stage !== "cadrage",
        };
      })
    : [];

  // ── Catalogue global Ahead (super_admin) ──
  let aheadItems: FormationListItem[] = [];
  if (subscribed) {
    const [{ data: aheadFormations }, { data: tenantFormations }] = await Promise.all([
      supabase
        .from("formations")
        .select("id, title, niveau, created_at")
        .eq("is_published", true)
        .is("tenant_id", null)
        .order("created_at", { ascending: false }),
      supabase.from("tenant_formations").select("formation_id").eq("tenant_id", tenantId),
    ]);
    const enabledIds = new Set((tenantFormations ?? []).map((tf) => tf.formation_id));

    const aheadIds = (aheadFormations ?? []).map((f) => f.id);
    const { data: modules } = aheadIds.length > 0
      ? await supabase.from("modules").select("id, formation_id, lecons(id)").in("formation_id", aheadIds)
      : { data: [] as { id: string; formation_id: string; lecons: { id: string }[] }[] };

    const countsByFormation: Record<string, { moduleCount: number; lessonCount: number }> = {};
    (modules ?? []).forEach((m) => {
      const entry = countsByFormation[m.formation_id] ?? { moduleCount: 0, lessonCount: 0 };
      entry.moduleCount += 1;
      entry.lessonCount += (m.lecons as { id: string }[] ?? []).length;
      countsByFormation[m.formation_id] = entry;
    });

    aheadItems = (aheadFormations ?? []).map((f) => {
      const counts = countsByFormation[f.id] ?? { moduleCount: 0, lessonCount: 0 };
      return {
        source: "ahead",
        id: f.id,
        title: f.title,
        createdAt: f.created_at,
        niveau: f.niveau,
        moduleCount: counts.moduleCount,
        lessonCount: counts.lessonCount,
        enabled: enabledIds.has(f.id),
      };
    });
  }

  const items = [...ownItems, ...aheadItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <Sparkles size={13} />
            Formations
          </div>
          <h1 className={styles.title}>Formations</h1>
          <p className={styles.subtitle}>
            Les formations que vous créez avec l&apos;assistant IA et celles du catalogue Ahead, au même endroit.
          </p>
        </div>
        {eligible && (
          <Link href="/org/formations/new" className={styles.newBtn}>
            <Plus size={16} />
            Nouvelle formation
          </Link>
        )}
      </div>

      {!eligible && <UpgradeNotice />}

      {items.length === 0 ? (
        eligible && (
          <div className={styles.emptyState}>
            <Sparkles size={26} className={styles.emptyIcon} />
            <p className={styles.emptyText}>Vous n&apos;avez pas encore créé de formation.</p>
            <Link href="/org/formations/new" className={styles.newBtn}>
              <Plus size={16} />
              Créer ma première formation
            </Link>
          </div>
        )
      ) : (
        <FormationsListClient items={items} />
      )}
    </div>
  );
}
