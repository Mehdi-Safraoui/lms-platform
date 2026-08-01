import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, BookOpen, CheckCircle, ArrowRight, CreditCard } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/stripe";
import styles from "./org.module.css";

function startOfMonth(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

function monthLabel(date: Date): string {
  const label = date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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
  const tenantId = user.tenant_id;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    { data: tenant },
    { count: apprenantCount },
    { count: apprenantNewThisMonth },
    { count: completedCount },
    { data: tenantFormationRows },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from("tenants").select("name, subscription_status, subscription_plan").eq("id", tenantId).single(),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("role", "apprenant"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("role", "apprenant").gte("created_at", monthStart),
    supabase.from("progress").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "completed"),
    supabase.from("tenant_formations").select("formation_id").eq("tenant_id", tenantId),
    supabase.from("progress").select("user_id, lecon_id, status, updated_at").eq("tenant_id", tenantId).gte("updated_at", sixMonthsAgo.toISOString()),
  ]);

  const tenantName = tenant?.name ?? "votre organisation";
  const tenantFormationIds = (tenantFormationRows ?? []).map((r) => r.formation_id);

  const [{ data: formations }, { data: modules }, { data: enrollments }] = await Promise.all([
    tenantFormationIds.length > 0
      ? supabase.from("formations").select("id, title").eq("is_published", true).in("id", tenantFormationIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    tenantFormationIds.length > 0
      ? supabase.from("modules").select("id, formation_id, lecons(id)").in("formation_id", tenantFormationIds)
      : Promise.resolve({ data: [] as { id: string; formation_id: string; lecons: { id: string }[] }[] }),
    tenantFormationIds.length > 0
      ? supabase.from("user_enrollments").select("user_id, formation_id").eq("tenant_id", tenantId).in("formation_id", tenantFormationIds)
      : Promise.resolve({ data: [] as { user_id: string; formation_id: string }[] }),
  ]);

  // ── Graphique : apprenants actifs sur 6 mois ──
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const activeByMonth = months.map((m) => {
    const monthKey = `${m.getFullYear()}-${m.getMonth()}`;
    const users = new Set(
      (progressRows ?? [])
        .filter((p) => {
          const d = new Date(p.updated_at);
          return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
        })
        .map((p) => p.user_id)
    );
    return { label: monthLabel(m), count: users.size, isCurrent: m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear() };
  });
  const maxActive = Math.max(1, ...activeByMonth.map((m) => m.count));

  // ── Répartition par formation : inscrits + complétion moyenne ──
  const lessonsByFormation: Record<string, string[]> = {};
  (modules ?? []).forEach((mod) => {
    const ids = ((mod.lecons as { id: string }[]) ?? []).map((l) => l.id);
    lessonsByFormation[mod.formation_id] = [...(lessonsByFormation[mod.formation_id] ?? []), ...ids];
  });

  const completedByUser: Record<string, Set<string>> = {};
  (progressRows ?? []).forEach((p) => {
    if (p.status !== "completed") return;
    if (!completedByUser[p.user_id]) completedByUser[p.user_id] = new Set();
    completedByUser[p.user_id].add(p.lecon_id);
  });

  const enrollmentsByFormation: Record<string, string[]> = {};
  (enrollments ?? []).forEach((e) => {
    enrollmentsByFormation[e.formation_id] = [...(enrollmentsByFormation[e.formation_id] ?? []), e.user_id];
  });

  const formationBreakdown = (formations ?? []).map((f) => {
    const leconIds = lessonsByFormation[f.id] ?? [];
    const totalLessons = leconIds.length;
    const enrolledUserIds = enrollmentsByFormation[f.id] ?? [];
    const enrolledCount = enrolledUserIds.length;
    let avgPct = 0;
    if (enrolledCount > 0 && totalLessons > 0) {
      const sumRatio = enrolledUserIds.reduce((sum, uid) => {
        const completedSet = completedByUser[uid];
        const completedForFormation = completedSet ? leconIds.filter((id) => completedSet.has(id)).length : 0;
        return sum + completedForFormation / totalLessons;
      }, 0);
      avgPct = Math.round((sumRatio / enrolledCount) * 100);
    }
    return { id: f.id, title: f.title, enrolledCount, avgPct };
  });

  const planKey = tenant?.subscription_plan as PlanKey | null;
  const planName = planKey ? PLANS[planKey]?.name ?? planKey : "Aucun";
  const isActive = tenant?.subscription_status === "active" || tenant?.subscription_status === "trialing";

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
            {(apprenantNewThisMonth ?? 0) > 0 && <span className={styles.statDelta}>+{apprenantNewThisMonth} ce mois</span>}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconCoral}`}>
            <BookOpen size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{formationBreakdown.length}</span>
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
        <div className={`${styles.statCard} ${styles.statCardDark}`}>
          <div className={`${styles.statIcon} ${styles.statIconCoral}`}>
            <CreditCard size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{planName}</span>
            <span className={styles.statLabel}>{isActive ? "Abonnement actif" : "Abonnement inactif"}</span>
          </div>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.chartCard}>
          <span className={styles.cardTitle}>Apprenants actifs · 6 derniers mois</span>
          <div className={styles.chart} role="img" aria-label="Nombre d'apprenants actifs par mois sur les 6 derniers mois">
            {activeByMonth.map((m) => (
              <div key={m.label} className={styles.barCol}>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.bar} ${m.isCurrent ? styles.barCurrent : ""}`}
                    style={{ height: `${Math.max(4, (m.count / maxActive) * 100)}%` }}
                  >
                    <span className={styles.barTooltip}>{m.count} apprenant{m.count > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <span className={styles.barLabel}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sideCard}>
          <span className={styles.cardTitle}>Progression par formation</span>
          {formationBreakdown.length === 0 ? (
            <p className={styles.empty}>Aucune formation activée pour le moment.</p>
          ) : (
            <div className={styles.formationList}>
              {formationBreakdown.map((f) => (
                <div key={f.id} className={styles.formationRow}>
                  <div className={styles.formationRowHead}>
                    <span className={styles.formationTitle}>{f.title}</span>
                    <span className={styles.formationPct}>{f.avgPct}%</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${f.avgPct}%` }} />
                  </div>
                  <span className={styles.formationCaption}>{f.enrolledCount} inscrit{f.enrolledCount > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.actionSection}>
        <h2 className={styles.actionSectionTitle}>Accès rapide</h2>
        <div className={styles.actionGrid}>
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
          <Link href="/org/abonnement" className={styles.actionCard}>
            <div className={styles.actionCardIcon}>
              <CreditCard size={22} />
            </div>
            <div className={styles.actionCardBody}>
              <span className={styles.actionCardTitle}>Gérer l&apos;abonnement</span>
              <span className={styles.actionCardDesc}>
                Consultez votre plan, votre moyen de paiement et vos factures.
              </span>
            </div>
            <ArrowRight size={18} className={styles.actionCardArrow} />
          </Link>
        </div>
      </div>
    </div>
  );
}
