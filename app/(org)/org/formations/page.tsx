import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ClipboardList, Layers, PenSquare, CheckCircle2, Plus } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import UpgradeNotice from "./UpgradeNotice";
import FormationRow from "./FormationRow";
import styles from "./formations.module.css";

type Stage = "cadrage" | "structure" | "generation" | "published";

const STAGE_INFO: Record<Stage, { label: string; icon: typeof ClipboardList; href: (id: string) => string }> = {
  cadrage: { label: "Documents source / cadrage à compléter", icon: ClipboardList, href: (id) => `/org/formations/${id}/cadrage` },
  structure: { label: "Structure à générer/valider", icon: Layers, href: (id) => `/org/formations/${id}/structure` },
  generation: { label: "Génération de contenu en cours", icon: PenSquare, href: (id) => `/org/formations/${id}/generation` },
  published: { label: "Publiée", icon: CheckCircle2, href: (id) => `/org/formations/${id}/generation` },
};

export default async function MyFormationsPage() {
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

  const eligible = await canCreateFormationByAi(currentUser.tenant_id);

  const { data: formations } = await supabase
    .from("formations")
    .select("id, title, is_published, created_at")
    .eq("tenant_id", currentUser.tenant_id)
    .order("created_at", { ascending: false });

  const formationIds = (formations ?? []).map((f) => f.id);
  const [{ data: cadrages }, { data: structures }] = await Promise.all([
    formationIds.length > 0
      ? supabase.from("formation_cadrage").select("formation_id, completed_at").in("formation_id", formationIds)
      : { data: [] as { formation_id: string; completed_at: string | null }[] },
    formationIds.length > 0
      ? supabase.from("formation_structure").select("formation_id, validated_at").in("formation_id", formationIds)
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <Sparkles size={13} />
            Création par IA
          </div>
          <h1 className={styles.title}>Mes formations</h1>
          <p className={styles.subtitle}>
            Les formations que vous créez avec l&apos;assistant IA, visibles ici quel que soit leur avancement.
          </p>
        </div>
        {eligible && (
          <Link href="/org/formations/new" className={styles.newBtn}>
            <Plus size={16} />
            Nouvelle formation
          </Link>
        )}
      </div>

      {!eligible ? (
        <UpgradeNotice />
      ) : !formations || formations.length === 0 ? (
        <div className={styles.emptyState}>
          <Sparkles size={26} className={styles.emptyIcon} />
          <p className={styles.emptyText}>Vous n&apos;avez pas encore créé de formation.</p>
          <Link href="/org/formations/new" className={styles.newBtn}>
            <Plus size={16} />
            Créer ma première formation
          </Link>
        </div>
      ) : (
        <div className={styles.list}>
          {formations.map((f) => {
            const stage = stageFor(f);
            const info = STAGE_INFO[stage];
            return (
              <FormationRow
                key={f.id}
                formationId={f.id}
                title={f.title}
                createdAt={f.created_at}
                href={info.href(f.id)}
                stageLabel={info.label}
                stageIcon={<info.icon size={13} />}
                isPublished={f.is_published}
                isFinal={stage === "published"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
