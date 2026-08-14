import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import UpgradeNotice from "../UpgradeNotice";
import NewAiFormationForm from "./NewAiFormationForm";
import styles from "./new.module.css";

export default async function NewAiFormationPage() {
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
      <h1 className={styles.title}>Nouvelle formation</h1>
      <p className={styles.subtitle}>
        Donnez un titre à votre formation. Vous pourrez ensuite uploader vos documents source
        pour que l&apos;IA construise le contenu à partir de vos supports internes.
      </p>

      {eligible ? <NewAiFormationForm /> : <UpgradeNotice />}
    </div>
  );
}
