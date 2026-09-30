import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import UpgradeNotice from "../UpgradeNotice";
import { loadAuthoringFormation } from "../loadAuthoring";
import { AUTHORING_BASE_PATH, type AuthoringSpace } from "../space";
import GenerationClient from "./GenerationClient";
import styles from "./generation.module.css";

export default async function GenerationStep({ space, formationId }: { space: AuthoringSpace; formationId: string }) {
  const { formation, eligible } = await loadAuthoringFormation(space, formationId);
  const basePath = AUTHORING_BASE_PATH[space];

  const supabase = createServiceRoleSupabaseClient();
  const { data: structure } = await supabase
    .from("formation_structure")
    .select("validated_at")
    .eq("formation_id", formationId)
    .maybeSingle();

  if (eligible && !structure?.validated_at) {
    redirect(`${basePath}/${formationId}/structure`);
  }

  return (
    <div className={styles.page}>
      <Link href={`${basePath}/${formationId}/structure`} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Structure
      </Link>

      <div className={styles.eyebrow}>
        <Sparkles size={13} />
        Création par IA — Génération de contenu
      </div>
      <h1 className={styles.title}>{formation.title}</h1>
      <p className={styles.subtitle}>
        Générez le contenu de chaque leçon, relisez-le, ajustez-le si besoin, puis validez pour passer à
        la suivante. La formation ne sera publiée qu&apos;une fois toutes les leçons validées.
      </p>

      {eligible ? (
        <GenerationClient formationId={formationId} alreadyPublished={formation.is_published} space={space} />
      ) : (
        <UpgradeNotice />
      )}
    </div>
  );
}
