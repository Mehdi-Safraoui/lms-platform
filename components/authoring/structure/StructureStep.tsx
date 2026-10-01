import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import UpgradeNotice from "../UpgradeNotice";
import { loadAuthoringFormation } from "../loadAuthoring";
import { AUTHORING_BASE_PATH, type AuthoringSpace } from "../space";
import StructureClient from "./StructureClient";
import styles from "./structure.module.css";

export default async function StructureStep({ space, formationId }: { space: AuthoringSpace; formationId: string }) {
  const { formation, eligible } = await loadAuthoringFormation(space, formationId);
  const basePath = AUTHORING_BASE_PATH[space];

  const supabase = createServiceRoleSupabaseClient();
  const { data: cadrage } = await supabase
    .from("formation_cadrage")
    .select("completed_at, nb_modules_souhaite")
    .eq("formation_id", formationId)
    .maybeSingle();

  if (eligible && !cadrage?.completed_at) {
    redirect(`${basePath}/${formationId}/cadrage`);
  }

  const { data: existingStructure } = await supabase
    .from("formation_structure")
    .select("*")
    .eq("formation_id", formationId)
    .maybeSingle();

  return (
    <div className={styles.page}>
      <Link href={`${basePath}/${formationId}/cadrage`} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Cadrage
      </Link>

      <h1 className={styles.title}>{formation.title}</h1>
      <p className={styles.subtitle}>
        L&apos;IA propose un découpage Module → Leçon à partir de vos documents et de votre cadrage.
        Ajustez-le librement avant de valider — rien n&apos;est généré tant que vous n&apos;avez pas confirmé.
      </p>

      {eligible ? (
        <StructureClient
          formationId={formationId}
          basePath={basePath}
          initialStructure={existingStructure}
          expectedModules={cadrage?.nb_modules_souhaite ?? null}
        />
      ) : (
        <UpgradeNotice />
      )}
    </div>
  );
}
