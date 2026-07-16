import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, BookOpen, CheckCircle, ArrowRight } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import styles from "./org.module.css";

export default async function OrgDashboardPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  const { data: user } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (!user?.tenant_id) redirect("/sign-in");

  const [{ data: tenant }, { count: apprenantCount }, { count: completedCount }, { count: formationCount }] =
    await Promise.all([
      supabase.from("tenants").select("name").eq("id", user.tenant_id).single(),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("tenant_id", user.tenant_id).eq("role", "apprenant"),
      supabase.from("progress").select("*", { count: "exact", head: true }).eq("tenant_id", user.tenant_id).eq("status", "completed"),
      supabase.from("formations").select("*", { count: "exact", head: true }).eq("is_published", true),
    ]);

  const tenantName = tenant?.name ?? "votre organisation";

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.heroEyebrow}>Tableau de bord</p>
        <h1 className={styles.heroTitle}>
          Bienvenue chez <span className={styles.heroAccent}>{tenantName}</span>
        </h1>
        <p className={styles.heroSub}>
          Suivez la progression de vos apprenants et pilotez vos formations en temps réel.
        </p>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconNavy}`}>
            <Users size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{apprenantCount ?? 0}</span>
            <span className={styles.statLabel}>Apprenants inscrits</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconCoral}`}>
            <BookOpen size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{formationCount ?? 0}</span>
            <span className={styles.statLabel}>Formations disponibles</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
            <CheckCircle size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{completedCount ?? 0}</span>
            <span className={styles.statLabel}>Leçons terminées</span>
          </div>
        </div>
      </div>

      <div className={styles.actionSection}>
        <h2 className={styles.actionSectionTitle}>Accès rapide</h2>
        <Link href="/org/apprenants" className={styles.actionCard}>
          <div className={styles.actionCardIcon}>
            <Users size={22} />
          </div>
          <div className={styles.actionCardBody}>
            <span className={styles.actionCardTitle}>Progression des apprenants</span>
            <span className={styles.actionCardDesc}>
              Consultez l&apos;avancement de chaque apprenant formation par formation.
            </span>
          </div>
          <ArrowRight size={18} className={styles.actionCardArrow} />
        </Link>
      </div>
    </div>
  );
}
