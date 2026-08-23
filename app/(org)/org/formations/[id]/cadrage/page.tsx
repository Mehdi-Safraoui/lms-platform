import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import UpgradeNotice from "../../UpgradeNotice";
import CadrageClient from "./CadrageClient";
import styles from "./cadrage.module.css";

type Props = { params: Promise<{ id: string }> };

export default async function FormationCadragePage({ params }: Props) {
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

  const { count: readySourcesCount } = await supabase
    .from("knowledge_sources")
    .select("*", { count: "exact", head: true })
    .eq("formation_id", formationId)
    .eq("ingestion_status", "terminee");

  if (eligible && !readySourcesCount) {
    redirect(`/org/formations/${formationId}/sources`);
  }

  const { data: existingCadrage } = await supabase
    .from("formation_cadrage")
    .select("*")
    .eq("formation_id", formationId)
    .maybeSingle();

  return (
    <div className={styles.page}>
      <Link href={`/org/formations/${formationId}/sources`} className={styles.back}>
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
        <CadrageClient formationId={formationId} initialCadrage={existingCadrage} />
      ) : (
        <UpgradeNotice />
      )}
    </div>
  );
}
