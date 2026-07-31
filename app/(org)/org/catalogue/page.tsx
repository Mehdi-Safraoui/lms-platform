import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Layers, Clock } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { formatDuration } from "@/lib/utils";
import CatalogueToggle from "./CatalogueToggle";
import styles from "./catalogue.module.css";

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export default async function CataloguePage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const supabase = createServiceRoleSupabaseClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (!dbUser?.tenant_id) notFound();

  if (!(await hasActiveSubscription(dbUser.tenant_id))) redirect("/pricing");

  const [{ data: formations }, { data: tenant_formations }] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, description, niveau, estimated_duration_minutes")
      .eq("is_published", true)
      .is("tenant_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("tenant_formations")
      .select("formation_id")
      .eq("tenant_id", dbUser.tenant_id),
  ]);

  const enrolledIds = new Set((tenant_formations ?? []).map((e) => e.formation_id));

  const formationIds = (formations ?? []).map((f) => f.id);
  const { data: modules } =
    formationIds.length > 0
      ? await supabase.from("modules").select("id, formation_id, lecons(id)").in("formation_id", formationIds)
      : { data: [] as { id: string; formation_id: string; lecons: { id: string }[] }[] };

  const countsByFormation: Record<string, { moduleCount: number; lessonCount: number }> = {};
  (modules ?? []).forEach((m) => {
    const entry = countsByFormation[m.formation_id] ?? { moduleCount: 0, lessonCount: 0 };
    entry.moduleCount += 1;
    entry.lessonCount += (m.lecons as { id: string }[] ?? []).length;
    countsByFormation[m.formation_id] = entry;
  });

  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>
        <span className={styles.dot} />
        Catalogue Ahead
      </div>
      <h1 className={styles.title}>Formations disponibles</h1>
      <p className={styles.subtitle}>
        Activez les formations que vous souhaitez rendre accessibles à vos apprenants.
      </p>

      {!formations?.length ? (
        <p className={styles.empty}>Aucune formation publiée pour le moment.</p>
      ) : (
        <div className={styles.grid}>
          {formations.map((f) => {
            const counts = countsByFormation[f.id] ?? { moduleCount: 0, lessonCount: 0 };
            const enabled = enrolledIds.has(f.id);
            return (
              <div key={f.id} className={`${styles.card} ${enabled ? styles.cardEnabled : ""}`}>
                <div className={styles.cardIcon}>
                  <BookOpen size={20} strokeWidth={1.75} />
                </div>
                <div className={styles.cardMeta}>
                  {f.niveau && (
                    <span className={styles.badge}>{NIVEAU_LABEL[f.niveau] ?? f.niveau}</span>
                  )}
                  {enabled && <span className={styles.enabledBadge}>Activée</span>}
                </div>
                <h2 className={styles.cardTitle}>{f.title}</h2>
                {f.description && <p className={styles.cardDesc}>{f.description}</p>}

                <div className={styles.cardStats}>
                  <span className={styles.cardStat}>
                    <Layers size={13} />
                    {counts.moduleCount} module{counts.moduleCount > 1 ? "s" : ""}
                  </span>
                  <span className={styles.cardStat}>
                    <BookOpen size={13} />
                    {counts.lessonCount} leçon{counts.lessonCount > 1 ? "s" : ""}
                  </span>
                  {f.estimated_duration_minutes && (
                    <span className={styles.cardStat}>
                      <Clock size={13} />
                      {formatDuration(f.estimated_duration_minutes)}
                    </span>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <CatalogueToggle formationId={f.id} enabled={enabled} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
