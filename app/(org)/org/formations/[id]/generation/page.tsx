import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import UpgradeNotice from "../../UpgradeNotice";
import GenerationClient from "./GenerationClient";
import styles from "./generation.module.css";

type Props = { params: Promise<{ id: string }> };

export default async function FormationGenerationPage({ params }: Props) {
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
    .select("id, title, tenant_id, is_published")
    .eq("id", formationId)
    .single();

  if (!formation || formation.tenant_id !== currentUser.tenant_id) notFound();

  const eligible = await canCreateFormationByAi(currentUser.tenant_id);

  const { data: structure } = await supabase
    .from("formation_structure")
    .select("validated_at")
    .eq("formation_id", formationId)
    .maybeSingle();

  if (eligible && !structure?.validated_at) {
    redirect(`/org/formations/${formationId}/structure`);
  }

  return (
    <div className={styles.page}>
      <Link href={`/org/formations/${formationId}/structure`} className={styles.back}>
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
        <GenerationClient formationId={formationId} alreadyPublished={formation.is_published} />
      ) : (
        <UpgradeNotice />
      )}
    </div>
  );
}
