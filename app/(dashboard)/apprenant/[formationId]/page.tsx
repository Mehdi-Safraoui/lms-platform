import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText, Video, ClipboardList, CheckCircle, Circle, Lock, BookOpen, Layers, Clock, Building2, Award } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { hasActiveSubscription } from "@/lib/subscription";
import { isFormationAccessibleToTenant } from "@/lib/formationTenantAccess";
import { formatDuration } from "@/lib/utils";
import { getOrIssueCertificate, certificateUrl, formatCertificateDate, linkedinAddToProfileUrl } from "@/lib/certificates";
import CertificateActions from "@/components/certificates/CertificateActions";
import certStyles from "@/components/certificates/certificate.module.css";
import EnrollButton from "./EnrollButton";
import styles from "./formation.module.css";

type Props = { params: Promise<{ formationId: string }> };

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

const FREE_PREVIEW_LESSON_COUNT = 2;

interface FormationVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
}

export default async function FormationDetailPage({ params }: Props) {
  const { formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  // Leçons incluses dans la même requête que les modules (au lieu d'une requête par module).
  const [{ data: formation }, { data: modules }, dbUser] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, description, niveau, estimated_duration_minutes, attestation_threshold_pct, videos, tenant_id")
      .eq("id", formationId)
      .eq("is_published", true)
      .single(),
    supabase
      .from("modules")
      .select("id, title, order_index, lecons(id, title, content_type, order_index)")
      .eq("formation_id", formationId)
      .order("order_index")
      .order("order_index", { referencedTable: "lecons" }),
    getCurrentUser(),
  ]);

  if (!formation) notFound();

  // Accès, abonnement et inscription : lectures indépendantes, en parallèle.
  const [accessible, tenantHasSubscription, { data: enrollment }] = await Promise.all([
    isFormationAccessibleToTenant(supabase, dbUser?.tenant_id ?? null, formation),
    dbUser?.tenant_id ? hasActiveSubscription(dbUser.tenant_id) : false,
    dbUser
      ? supabase.from("user_enrollments").select("id").eq("user_id", dbUser.id).eq("formation_id", formationId).maybeSingle()
      : { data: null },
  ]);
  if (!accessible) notFound();
  const isEnrolled = !!enrollment;

  // Vue non-inscrit : aperçu verrouillé + bouton S'inscrire
  if (!isEnrolled) {
    return (
      <div className={styles.page}>
        <nav className={styles.breadcrumb}>
          <Link href="/apprenant">Mes formations</Link>
          <ChevronRight size={14} />
          <span>{formation.title}</span>
        </nav>

        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          {formation.niveau ? NIVEAU_LABEL[formation.niveau] ?? formation.niveau : "Formation"}
        </div>

        <h1 className={styles.title}>{formation.title}</h1>
        {formation.description && <p className={styles.desc}>{formation.description}</p>}

        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <Layers size={14} />
            {modules?.length ?? 0} module{(modules?.length ?? 0) > 1 ? "s" : ""}
          </span>
          {formation.estimated_duration_minutes && (
            <span className={styles.metaItem}>
              <Clock size={14} />
              {formatDuration(formation.estimated_duration_minutes)}
            </span>
          )}
        </div>

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
                <span className={styles.moduleNumber}>{String(idx + 1).padStart(2, "0")}</span>
                <div className={styles.moduleHeaderText}>
                  <h2 className={styles.moduleTitle}>{mod.title}</h2>
                </div>
                <Lock size={14} className={styles.lockIcon} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vue inscrit : contenu complet avec progression
  const lessonsByModule: Record<string, { id: string; title: string; content_type: string }[]> = Object.fromEntries(
    (modules ?? []).map((mod) => [mod.id, (mod.lecons ?? []) as { id: string; title: string; content_type: string }[]])
  );

  const allLeconIds = (modules ?? []).flatMap((m) => lessonsByModule[m.id]?.map((l) => l.id) ?? []);

  // Progression et certificat (délivré automatiquement dès le seuil de
  // complétion atteint), en parallèle.
  const [{ data: progressRecords }, certificateStatus] = await Promise.all([
    dbUser && allLeconIds.length > 0
      ? supabase.from("progress").select("lecon_id, status").eq("user_id", dbUser.id).in("lecon_id", allLeconIds)
      : { data: [] as { lecon_id: string; status: string }[] },
    dbUser ? getOrIssueCertificate(supabase, dbUser.id, formationId) : null,
  ]);
  const userProgress: Record<string, string> = Object.fromEntries((progressRecords ?? []).map((p) => [p.lecon_id, p.status]));
  const completedCount = (progressRecords ?? []).filter((p) => p.status === "completed").length;

  const totalLessons = allLeconIds.length;
  const completionRate = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/apprenant">Mes formations</Link>
        <ChevronRight size={14} />
        <span>{formation.title}</span>
      </nav>

      <div className={styles.eyebrowRow}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          {formation.niveau ? NIVEAU_LABEL[formation.niveau] ?? formation.niveau : "Formation"}
        </div>
        {formation.tenant_id && (
          <span className={styles.companyBadge}>
            <Building2 size={11} />
            Créée par votre entreprise
          </span>
        )}
      </div>

      <h1 className={styles.title}>{formation.title}</h1>
      {formation.description && <p className={styles.desc}>{formation.description}</p>}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <Layers size={14} />
          {modules?.length ?? 0} module{(modules?.length ?? 0) > 1 ? "s" : ""}
        </span>
        <span className={styles.metaItem}>
          <BookOpen size={14} />
          {totalLessons} leçon{totalLessons > 1 ? "s" : ""}
        </span>
        {formation.estimated_duration_minutes && (
          <span className={styles.metaItem}>
            <Clock size={14} />
            {formatDuration(formation.estimated_duration_minutes)}
          </span>
        )}
      </div>

      {((formation.videos as FormationVideo[] | null) ?? []).map((video) => (
        <div key={video.videoId} className={styles.videoWrap}>
          <iframe
            className={styles.videoFrame}
            src={`https://www.youtube.com/embed/${video.videoId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ))}

      {totalLessons > 0 && (
        <div className={styles.progressCard}>
          <div className={styles.progressMeta}>
            <span className={styles.progressLabel}>Votre progression</span>
            <span className={styles.progressPct}>{completionRate}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${completionRate}%` }} />
          </div>
          <span className={styles.progressCaption}>
            {completedCount}/{totalLessons} leçons terminées · Certificat à {formation.attestation_threshold_pct}% de complétion
          </span>
        </div>
      )}

      {certificateStatus?.certificate ? (
        <div className={certStyles.card}>
          <div className={certStyles.cardHead}>
            <span className={certStyles.cardIcon}>
              <Award size={20} />
            </span>
            <div>
              <p className={certStyles.cardTitle}>Certificat obtenu</p>
              <p className={certStyles.cardText}>
                Délivré le {formatCertificateDate(certificateStatus.certificate.issued_at)} — téléchargez-le ou ajoutez-le à votre profil LinkedIn.
              </p>
            </div>
          </div>
          <CertificateActions
            pdfHref={`/api/certificates/${certificateStatus.certificate.id}/pdf`}
            linkedinHref={linkedinAddToProfileUrl(certificateStatus.certificate)}
            shareUrl={certificateUrl(certificateStatus.certificate.id)}
          />
        </div>
      ) : (
        certificateStatus && certificateStatus.total > 0 && (
          <div className={`${certStyles.card} ${certStyles.cardLocked}`}>
            <div className={certStyles.cardHead}>
              <span className={`${certStyles.cardIcon} ${certStyles.cardIconLocked}`}>
                <Award size={20} />
              </span>
              <div>
                <p className={certStyles.cardTitle}>Certificat de réussite</p>
                <p className={certStyles.cardText}>
                  {(() => {
                    const needed = Math.max(0, Math.ceil((certificateStatus.thresholdPct / 100) * certificateStatus.total) - certificateStatus.completed);
                    return `Encore ${needed} leçon${needed > 1 ? "s" : ""} à terminer (quiz réussis compris) pour obtenir votre certificat, délivré à ${certificateStatus.thresholdPct} % de complétion.`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        )
      )}

      <div className={styles.modules}>
        {(modules ?? []).map((mod, idx) => (
          <div key={mod.id} className={styles.module}>
            <div className={styles.moduleHeader}>
              <span className={styles.moduleNumber}>{String(idx + 1).padStart(2, "0")}</span>
              <div className={styles.moduleHeaderText}>
                <h2 className={styles.moduleTitle}>{mod.title}</h2>
                <span className={styles.moduleCaption}>
                  {lessonsByModule[mod.id]?.length ?? 0} leçon{(lessonsByModule[mod.id]?.length ?? 0) > 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className={styles.lessons}>
              {lessonsByModule[mod.id]?.map((lesson, lessonIdx) => {
                const status = userProgress[lesson.id];
                const isLocked = !tenantHasSubscription && allLeconIds.indexOf(lesson.id) >= FREE_PREVIEW_LESSON_COUNT;
                return (
                  <Link
                    key={lesson.id}
                    href={`/apprenant/${formationId}/${lesson.id}`}
                    className={styles.lesson}
                  >
                    <span className={styles.lessonIconWrap}>
                      {lesson.content_type === "video" ? (
                        <Video size={14} />
                      ) : lesson.content_type === "quiz" ? (
                        <ClipboardList size={14} />
                      ) : (
                        <FileText size={14} />
                      )}
                    </span>
                    <span className={styles.lessonMeta}>
                      <span className={styles.lessonIndex}>Leçon {lessonIdx + 1}</span>
                      <span className={styles.lessonTitle}>{lesson.title}</span>
                    </span>
                    <span className={styles.lessonStatus}>
                      {isLocked ? (
                        <Lock size={13} className={styles.lockIcon} />
                      ) : status === "completed" ? (
                        <CheckCircle size={15} className={styles.statusDone} />
                      ) : status === "in_progress" ? (
                        <Circle size={15} className={styles.statusInProgress} />
                      ) : (
                        <ChevronRight size={15} className={styles.lessonArrow} />
                      )}
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
