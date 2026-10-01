import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import UpgradeNotice from "../UpgradeNotice";
import { loadAuthoringUser } from "../loadAuthoring";
import { getFormationQuota } from "@/lib/aiGenerationQuota";
import { AUTHORING_BASE_PATH, AUTHORING_CATALOGUE_PATH, type AuthoringSpace } from "../space";
import NewAiFormationForm from "./NewAiFormationForm";
import styles from "./new.module.css";

export default async function NewFormationStep({ space }: { space: AuthoringSpace }) {
  const { eligible, tenantId } = await loadAuthoringUser(space);
  const quota = eligible ? await getFormationQuota(tenantId) : null;
  const quotaReached = quota !== null && quota.total !== null && quota.used >= quota.total;

  return (
    <div className={styles.page}>
      <Link href={AUTHORING_CATALOGUE_PATH[space]} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Catalogue
      </Link>

      <div className={styles.eyebrow}>
        <Sparkles size={13} />
        Création par IA
      </div>
      <h1 className={styles.title}>Nouvelle formation</h1>
      <p className={styles.subtitle}>
        Donnez un titre à votre formation. Vous pourrez ensuite uploader vos documents source
        pour que l&apos;IA construise le contenu à partir de vos supports internes.
      </p>

      {quota && quota.total !== null && (
        <p className={quotaReached ? styles.quotaReached : styles.quotaInfo}>
          {quota.used} / {quota.total} formation{quota.total > 1 ? "s" : ""} IA utilisée{quota.used > 1 ? "s" : ""} ce mois-ci
          {quotaReached
            ? " — quota atteint. Il se renouvelle le 1er du mois ; contactez Ahead pour l'augmenter."
            : ". Une formation est comptée à la génération de sa structure ; ses leçons et régénérations sont incluses."}
        </p>
      )}

      {!eligible ? <UpgradeNotice /> : quotaReached ? null : <NewAiFormationForm basePath={AUTHORING_BASE_PATH[space]} />}
    </div>
  );
}
