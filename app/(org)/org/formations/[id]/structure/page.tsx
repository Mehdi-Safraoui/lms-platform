import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import UpgradeNotice from "../../UpgradeNotice";
import StructureClient from "./StructureClient";
import styles from "./structure.module.css";

type Props = { params: Promise<{ id: string }> };

export default async function FormationStructurePage({ params }: Props) {
  const { id: formationId } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  const { data: currentUser } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (!currentUser?.tenant_id || currentUser.role !== "admin_tenant") {
    redirect("/org");
  }

  const { data: formation } = await supabase
    .from("formations")
    .select("id, title, tenant_id")
    .eq("id", formationId)
    .single();

  if (!formation || formation.tenant_id !== currentUser.tenant_id) notFound();

  const eligible = await canCreateFormationByAi(currentUser.tenant_id);

  const { data: cadrage } = await supabase
    .from("formation_cadrage")
    .select("completed_at")
    .eq("formation_id", formationId)
    .maybeSingle();

  if (eligible && !cadrage?.completed_at) {
    redirect(`/org/formations/${formationId}/cadrage`);
  }

  const { data: existingStructure } = await supabase
    .from("formation_structure")
    .select("*")
    .eq("formation_id", formationId)
    .maybeSingle();

  return (
    <div className={styles.page}>
      <Link href={`/org/formations/${formationId}/cadrage`} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Cadrage
      </Link>

      <div className={styles.eyebrow}>
        <Sparkles size={13} />
        Création par IA — Structure
      </div>
      <h1 className={styles.title}>{formation.title}</h1>
      <p className={styles.subtitle}>
        L&apos;IA propose un découpage Module → Leçon à partir de vos documents et de votre cadrage.
        Ajustez-le librement avant de valider — rien n&apos;est généré tant que vous n&apos;avez pas confirmé.
      </p>

      {eligible ? (
        <StructureClient formationId={formationId} initialStructure={existingStructure} />
      ) : (
        <UpgradeNotice />
      )}
    </div>
  );
}
