import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadAuthoringFormation } from "@/components/authoring/loadAuthoring";
import styles from "@/components/authoring/generation/generation.module.css";
import VideoStepClient from "./VideoStepClient";

type Props = { params: Promise<{ id: string }> };

// Dernière étape du flow IA côté catalogue (après publication) : vidéo
// d'accompagnement de la formation, puis éditeur admin pour compléter la fiche
// (description, niveau, durée). Reprend l'étape post-génération de l'ancien
// mode "génération en un coup" retiré au profit du flow complet.
export default async function CatalogueVideoPage({ params }: Props) {
  const { id } = await params;
  const { formation } = await loadAuthoringFormation("admin", id);

  return (
    <div className={styles.page}>
      <Link href={`/admin/catalog/${id}/generation`} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Génération de contenu
      </Link>

      <h1 className={styles.title}>{formation.title}</h1>

      <VideoStepClient formationId={id} suggestedQuery={formation.title} />
    </div>
  );
}
