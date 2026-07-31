import { Building2, Users, BookOpen, Wallet, AlertTriangle } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import styles from "./admin.module.css";

const PLAN_COLOR: Record<PlanKey, string> = {
  entreprise: "#2a78d6",
  creation: "#eb6834",
  decouverte: "#1baf7a",
};

function startOfMonth(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

function monthLabel(date: Date): string {
  const label = date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function AdminOverviewPage() {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    { count: tenantsActifs },
    { count: tenantsNewThisMonth },
    { count: apprenantsTotal },
    { count: apprenantsNewThisMonth },
    { count: formationsPubliees },
    { data: tenantPlans },
    { count: paymentsFailedCount },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }).in("subscription_status", ["active", "trialing"]),
    supabase.from("tenants").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "apprenant"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "apprenant").gte("created_at", monthStart),
    supabase.from("formations").select("*", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("tenants").select("subscription_plan").in("subscription_status", ["active", "trialing"]),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("subscription_status", "past_due"),
    supabase.from("progress").select("user_id, updated_at").gte("updated_at", sixMonthsAgo.toISOString()),
  ]);

  const planCounts: Record<string, number> = {};
  (tenantPlans ?? []).forEach((t) => {
    if (!t.subscription_plan) return;
    planCounts[t.subscription_plan] = (planCounts[t.subscription_plan] ?? 0) + 1;
  });

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

  let mrr = 0;
  try {
    const activeSubs = await stripe.subscriptions.list({ status: "active", limit: 100 });
    for (const sub of activeSubs.data) {
      for (const item of sub.items.data) {
        const amount = (item.price.unit_amount ?? 0) * (item.quantity ?? 1);
        if (item.price.recurring?.interval === "year") mrr += amount / 12;
        else mrr += amount;
      }
    }
    mrr = mrr / 100;
  } catch (err) {
    console.error("[admin overview] Stripe MRR error:", err);
  }

  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>
        <span className={styles.dot} />
        Flow super-admin · Ahead
      </div>
      <h1 className={styles.title}>Vue globale</h1>
      <p className={styles.subtitle}>Activité de la plateforme, tous tenants confondus.</p>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}><Building2 size={14} /> Tenants actifs</span>
          <span className={styles.statValue}>{tenantsActifs ?? 0}</span>
          {(tenantsNewThisMonth ?? 0) > 0 && <span className={styles.statDelta}>+{tenantsNewThisMonth} ce mois</span>}
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}><Users size={14} /> Apprenants</span>
          <span className={styles.statValue}>{apprenantsTotal ?? 0}</span>
          {(apprenantsNewThisMonth ?? 0) > 0 && <span className={styles.statDelta}>+{apprenantsNewThisMonth} ce mois</span>}
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}><BookOpen size={14} /> Formations publiées</span>
          <span className={styles.statValue}>{formationsPubliees ?? 0}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardDark}`}>
          <span className={styles.statLabel}><Wallet size={14} /> MRR · Stripe</span>
          <span className={styles.statValue}>{mrr.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€</span>
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
          <span className={styles.cardTitle}>Abonnements Stripe</span>
          <div className={styles.legendList}>
            {(Object.keys(PLANS) as PlanKey[]).map((key) => (
              <div key={key} className={styles.legendRow}>
                <span className={styles.legendDot} style={{ background: PLAN_COLOR[key] }} />
                <span className={styles.legendLabel}>{PLANS[key].name}</span>
                <span className={styles.legendValue}>{planCounts[key] ?? 0}</span>
              </div>
            ))}
          </div>
          {(paymentsFailedCount ?? 0) > 0 && (
            <div className={styles.failedBadge}>
              <AlertTriangle size={13} />
              {paymentsFailedCount} paiement{(paymentsFailedCount ?? 0) > 1 ? "s" : ""} en échec
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
