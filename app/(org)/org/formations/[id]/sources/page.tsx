import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import UpgradeNotice from "../../UpgradeNotice";
import SourcesClient from "./SourcesClient";
import styles from "./sources.module.css";

type Props = { params: Promise<{ id: string }> };

export default async function FormationSourcesPage({ params }: Props) {
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

  return (
    <div className={styles.page}>
      <Link href="/org/catalogue" className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Catalogue
      </Link>

      <div className={styles.eyebrow}>
        <Sparkles size={13} />
        Création par IA
      </div>
      <h1 className={styles.title}>{formation.title}</h1>
      <p className={styles.subtitle}>
        Ajoutez vos documents source (PDF, Word, PowerPoint, texte brut) ou des liens web —
        c&apos;est à partir de ce contenu que l&apos;IA générera votre formation.
      </p>

      {eligible ? <SourcesClient formationId={formationId} /> : <UpgradeNotice />}
    </div>
  );
}
