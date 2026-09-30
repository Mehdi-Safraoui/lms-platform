import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import UpgradeNotice from "../UpgradeNotice";
import { loadAuthoringUser } from "../loadAuthoring";
import { AUTHORING_BASE_PATH, AUTHORING_CATALOGUE_PATH, type AuthoringSpace } from "../space";
import NewAiFormationForm from "./NewAiFormationForm";
import styles from "./new.module.css";

export default async function NewFormationStep({ space }: { space: AuthoringSpace }) {
  const { eligible } = await loadAuthoringUser(space);

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

      {eligible ? <NewAiFormationForm basePath={AUTHORING_BASE_PATH[space]} /> : <UpgradeNotice />}
    </div>
  );
}
