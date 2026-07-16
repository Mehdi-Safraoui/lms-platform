import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ChevronRight, FileText, Video, ClipboardList, CheckCircle, Circle, Lock } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import EnrollButton from "./EnrollButton";
import styles from "./formation.module.css";

type Props = { params: Promise<{ formationId: string }> };

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export default async function FormationDetailPage({ params }: Props) {
  const { formationId } = await params;
  const { userId: clerkUserId } = await auth();
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: formation }, { data: modules }, { data: dbUser }] = await Promise.all([
    supabase.from("formations").select("id, title, description, niveau").eq("id", formationId).eq("is_published", true).single(),
    supabase.from("modules").select("id, title, order_index").eq("formation_id", formationId).order("order_index"),
    clerkUserId
      ? supabase.from("users").select("id").eq("clerk_user_id", clerkUserId).single()
      : { data: null },
  ]);

  if (!formation) notFound();

  // Vérifier si l'apprenant est inscrit à cette formation
  let isEnrolled = false;
  if (dbUser) {
    const { data: enrollment } = await supabase
      .from("user_enrollments")
      .select("id")
      .eq("user_id", dbUser.id)
      .eq("formation_id", formationId)
      .single();
    isEnrolled = !!enrollment;
  }

  // Vue non-inscrit : aperçu verrouillé + bouton S'inscrire
  if (!isEnrolled) {
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

        <div className={styles.enrollCta}>
          <div className={styles.enrollCtaText}>
            <p>Inscrivez-vous pour accéder au contenu de cette formation et suivre votre progression.</p>
          </div>
          <EnrollButton formationId={formationId} />
        </div>

        {/* Aperçu verrouillé des modules */}
        <div className={styles.modules}>
          {(modules ?? []).map((mod, idx) => (
            <div key={mod.id} className={`${styles.module} ${styles.moduleLocked}`}>
              <div className={styles.moduleHeader}>
                <span className={styles.moduleIndex}>Module {idx + 1}</span>
                <h2 className={styles.moduleTitle}>{mod.title}</h2>
                <Lock size={14} className={styles.lockIcon} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vue inscrit : contenu complet avec progression
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

  const allLeconIds = (modules ?? []).flatMap((m) => lessonsByModule[m.id]?.map((l) => l.id) ?? []);
  let userProgress: Record<string, string> = {};
  let completedCount = 0;

  if (dbUser && allLeconIds.length > 0) {
    const { data: progressRecords } = await supabase
      .from("progress")
      .select("lecon_id, status")
      .eq("user_id", dbUser.id)
      .in("lecon_id", allLeconIds);

    userProgress = Object.fromEntries((progressRecords ?? []).map((p) => [p.lecon_id, p.status]));
    completedCount = (progressRecords ?? []).filter((p) => p.status === "completed").length;
  }

  const totalLessons = allLeconIds.length;
  const completionRate = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

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

      {totalLessons > 0 && (
        <div className={styles.progressBlock}>
          <div className={styles.progressMeta}>
            <span>{completedCount}/{totalLessons} leçons terminées</span>
            <span className={styles.progressPct}>{completionRate}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      )}

      <div className={styles.modules}>
        {(modules ?? []).map((mod, idx) => (
          <div key={mod.id} className={styles.module}>
            <div className={styles.moduleHeader}>
              <span className={styles.moduleIndex}>Module {idx + 1}</span>
              <h2 className={styles.moduleTitle}>{mod.title}</h2>
            </div>
            <div className={styles.lessons}>
              {lessonsByModule[mod.id]?.map((lesson) => {
                const status = userProgress[lesson.id];
                return (
                  <Link
                    key={lesson.id}
                    href={`/apprenant/${formationId}/${lesson.id}`}
                    className={styles.lesson}
                  >
                    {lesson.content_type === "video" ? (
                      <Video size={14} className={styles.lessonIcon} />
                    ) : lesson.content_type === "quiz" ? (
                      <ClipboardList size={14} className={styles.lessonIcon} />
                    ) : (
                      <FileText size={14} className={styles.lessonIcon} />
                    )}
                    <span className={styles.lessonTitle}>{lesson.title}</span>
                    <span className={styles.lessonStatus}>
                      {status === "completed" ? (
                        <CheckCircle size={15} className={styles.statusDone} />
                      ) : status === "in_progress" ? (
                        <Circle size={15} className={styles.statusInProgress} />
                      ) : null}
                    </span>
                  </Link>
                );
              })}
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
