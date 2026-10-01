import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { BadgeCheck } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { certificateUrl, formatCertificateDate, linkedinAddToProfileUrl, type Certificate } from "@/lib/certificates";
import CertificateActions from "@/components/certificates/CertificateActions";
import styles from "@/components/certificates/certificate.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadCertificate(id: string): Promise<Certificate | null> {
  if (!UUID.test(id)) return null;
  const supabase = createServiceRoleSupabaseClient();
  const { data } = await supabase.from("certificates").select("*").eq("id", id).maybeSingle();
  return (data as Certificate | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const certificate = await loadCertificate((await params).id);
  return certificate
    ? { title: `Certificat — ${certificate.formation_title}`, description: `Certificat de réussite délivré par Ahead Digital à ${certificate.learner_name}.` }
    : { title: "Certificat introuvable" };
}

// Page publique de vérification d'un certificat (lien partagé sur LinkedIn, à
// un recruteur, à un manager). Le titulaire connecté voit en plus l'ajout à
// son profil LinkedIn.
export default async function CertificateVerifyPage({ params }: Props) {
  const { id } = await params;
  const certificate = await loadCertificate(id);

  if (!certificate) {
    return (
      <main className={styles.verifyPage}>
        <div className={styles.verifyCard}>
          <span className={styles.verifyBrand}>Ahead Digital</span>
          <p className={styles.verifyNotFound}>Ce certificat n&apos;existe pas ou n&apos;est plus valide.</p>
        </div>
      </main>
    );
  }

  const { userId: clerkUserId } = await auth();
  let isOwner = false;
  if (clerkUserId) {
    const supabase = createServiceRoleSupabaseClient();
    const { data: viewer } = await supabase.from("users").select("id").eq("clerk_user_id", clerkUserId).maybeSingle();
    isOwner = viewer?.id === certificate.user_id;
  }

  return (
    <main className={styles.verifyPage}>
      <div className={styles.verifyCard}>
        <span className={styles.verifyBrand}>Ahead Digital</span>
        <span className={styles.verifyStatus}>
          <BadgeCheck size={16} />
          Certificat authentique
        </span>
        <div>
          <p className={styles.verifyName}>{certificate.learner_name}</p>
          <p className={styles.verifyFormation}>{certificate.formation_title}</p>
        </div>
        <dl className={styles.verifyMeta}>
          <dt>Délivré le</dt>
          <dd>{formatCertificateDate(certificate.issued_at)}</dd>
          {certificate.organization_name && (
            <>
              <dt>Entreprise</dt>
              <dd>{certificate.organization_name}</dd>
            </>
          )}
          <dt>Complétion</dt>
          <dd>{certificate.completion_pct} %</dd>
        </dl>
        <CertificateActions
          pdfHref={`/api/certificates/${certificate.id}/pdf`}
          linkedinHref={isOwner ? linkedinAddToProfileUrl(certificate) : null}
          shareUrl={certificateUrl(certificate.id)}
        />
        <span className={styles.verifyId}>Identifiant : {certificate.id}</span>
      </div>
    </main>
  );
}
