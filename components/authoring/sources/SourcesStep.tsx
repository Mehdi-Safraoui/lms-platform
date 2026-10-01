import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import UpgradeNotice from "../UpgradeNotice";
import { loadAuthoringFormation } from "../loadAuthoring";
import { AUTHORING_BASE_PATH, AUTHORING_CATALOGUE_PATH, type AuthoringSpace } from "../space";
import SourcesClient from "./SourcesClient";
import styles from "./sources.module.css";

export default async function SourcesStep({ space, formationId }: { space: AuthoringSpace; formationId: string }) {
  const { formation, eligible } = await loadAuthoringFormation(space, formationId);

  return (
    <div className={styles.page}>
      <Link href={AUTHORING_CATALOGUE_PATH[space]} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Catalogue
      </Link>

      <h1 className={styles.title}>{formation.title}</h1>
      <p className={styles.subtitle}>
        Ajoutez vos documents source (PDF, Word, PowerPoint, texte brut) ou des liens web —
        c&apos;est à partir de ce contenu que l&apos;IA générera votre formation.
      </p>

      {eligible ? <SourcesClient formationId={formationId} basePath={AUTHORING_BASE_PATH[space]} /> : <UpgradeNotice />}
    </div>
  );
}
