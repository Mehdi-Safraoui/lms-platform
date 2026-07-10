import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import styles from "./apprenant.module.css";

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export default async function ApprenantPage() {
  const supabase = createServiceRoleSupabaseClient();
  const { data: formations } = await supabase
    .from("formations")
    .select("id, title, description, niveau")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>
        <span className={styles.dot} />
        Espace apprenant
      </div>
      <h1 className={styles.title}>Mes formations</h1>

      {!formations?.length ? (
        <p className={styles.empty}>Aucune formation disponible pour le moment.</p>
      ) : (
        <div className={styles.grid}>
          {formations.map((f) => (
            <Link key={f.id} href={`/apprenant/${f.id}`} className={styles.card}>
              <div className={styles.cardIcon}>
                <BookOpen size={20} />
              </div>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{f.title}</h2>
                {f.description && <p className={styles.cardDesc}>{f.description}</p>}
                {f.niveau && (
                  <span className={styles.badge}>{NIVEAU_LABEL[f.niveau] ?? f.niveau}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
