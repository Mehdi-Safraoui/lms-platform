import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText, Video } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import styles from "./formation.module.css";

type Props = { params: Promise<{ formationId: string }> };

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export default async function FormationDetailPage({ params }: Props) {
  const { formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: formation }, { data: modules }] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, description, niveau")
      .eq("id", formationId)
      .eq("is_published", true)
      .single(),
    supabase
      .from("modules")
      .select("id, title, order_index")
      .eq("formation_id", formationId)
      .order("order_index"),
  ]);

  if (!formation) notFound();

  const lessonsByModule: Record<string, { id: string; title: string; content_type: string }[]> = {};
  await Promise.all(
    (modules ?? []).map(async (mod) => {
      const { data: lecons } = await supabase
        .from("lecons")
        .select("id, title, content_type")
        .eq("module_id", mod.id)
        .order("order_index");
      lessonsByModule[mod.id] = lecons ?? [];
    })
  );

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/apprenant">Mes formations</Link>
        <ChevronRight size={14} />
        <span>{formation.title}</span>
      </nav>

      <h1 className={styles.title}>{formation.title}</h1>
      {formation.description && <p className={styles.desc}>{formation.description}</p>}
      {formation.niveau && (
        <span className={styles.badge}>{NIVEAU_LABEL[formation.niveau] ?? formation.niveau}</span>
      )}

      <div className={styles.modules}>
        {(modules ?? []).map((mod, idx) => (
          <div key={mod.id} className={styles.module}>
            <div className={styles.moduleHeader}>
              <span className={styles.moduleIndex}>Module {idx + 1}</span>
              <h2 className={styles.moduleTitle}>{mod.title}</h2>
            </div>
            <div className={styles.lessons}>
              {lessonsByModule[mod.id]?.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/apprenant/${formationId}/${lesson.id}`}
                  className={styles.lesson}
                >
                  {lesson.content_type === "video" ? (
                    <Video size={14} className={styles.lessonIcon} />
                  ) : (
                    <FileText size={14} className={styles.lessonIcon} />
                  )}
                  <span>{lesson.title}</span>
                </Link>
              ))}
              {!lessonsByModule[mod.id]?.length && (
                <p className={styles.noLesson}>Aucune leçon dans ce module.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
