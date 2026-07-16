import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
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

  const [{ data: formations }, { data: tenant_formations }] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, description, niveau")
      .eq("is_published", true)
      .is("tenant_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("tenant_formations")
      .select("formation_id")
      .eq("tenant_id", dbUser.tenant_id),
  ]);

  const enrolledIds = new Set((tenant_formations ?? []).map((e) => e.formation_id));

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
          {formations.map((f) => (
            <div
              key={f.id}
              className={`${styles.card} ${enrolledIds.has(f.id) ? styles.cardEnabled : ""}`}
            >
              <div className={styles.cardBody}>
                <div className={styles.cardMeta}>
                  {f.niveau && (
                    <span className={styles.badge}>{NIVEAU_LABEL[f.niveau] ?? f.niveau}</span>
                  )}
                  {enrolledIds.has(f.id) && (
                    <span className={styles.enabledBadge}>Activée</span>
                  )}
                </div>
                <h2 className={styles.cardTitle}>{f.title}</h2>
                {f.description && <p className={styles.cardDesc}>{f.description}</p>}
              </div>
              <CatalogueToggle formationId={f.id} enabled={enrolledIds.has(f.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
