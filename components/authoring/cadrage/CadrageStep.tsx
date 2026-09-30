import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import UpgradeNotice from "../UpgradeNotice";
import { loadAuthoringFormation } from "../loadAuthoring";
import { AUTHORING_BASE_PATH, type AuthoringSpace } from "../space";
import CadrageClient from "./CadrageClient";
import styles from "./cadrage.module.css";

export default async function CadrageStep({ space, formationId }: { space: AuthoringSpace; formationId: string }) {
  const { formation, eligible } = await loadAuthoringFormation(space, formationId);
  const basePath = AUTHORING_BASE_PATH[space];

  const supabase = createServiceRoleSupabaseClient();
  const { count: readySourcesCount } = await supabase
    .from("knowledge_sources")
    .select("*", { count: "exact", head: true })
    .eq("formation_id", formationId)
    .eq("ingestion_status", "terminee");

  if (eligible && !readySourcesCount) {
    redirect(`${basePath}/${formationId}/sources`);
  }

  const { data: existingCadrage } = await supabase
    .from("formation_cadrage")
    .select("*")
    .eq("formation_id", formationId)
    .maybeSingle();

  return (
    <div className={styles.page}>
      <Link href={`${basePath}/${formationId}/sources`} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Documents source
      </Link>

      <div className={styles.eyebrow}>
        <Sparkles size={13} />
        Création par IA — Cadrage
      </div>
      <h1 className={styles.title}>{formation.title}</h1>
      <p className={styles.subtitle}>
        Quelques questions avant de générer votre formation — vos réponses guident l&apos;IA pour
        produire une formation cohérente et pédagogique, pas un simple résumé de vos documents.
      </p>

      {eligible ? (
        <CadrageClient formationId={formationId} basePath={basePath} initialCadrage={existingCadrage} />
      ) : (
        <UpgradeNotice />
      )}
    </div>
  );
}
