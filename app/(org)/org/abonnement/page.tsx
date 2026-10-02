import { redirect } from "next/navigation";
import { CreditCard, FileText, Download } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { getTenantUsage, nextQuotaResetLabel } from "@/lib/tenantUsage";
import { getCurrentUser, getTenant } from "@/lib/currentUser";
import ManageBillingButton from "./ManageBillingButton";
import styles from "./abonnement.module.css";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "statusActive" },
  trialing: { label: "Essai", className: "statusActive" },
  past_due: { label: "Impayé", className: "statusPastDue" },
  canceled: { label: "Annulé", className: "statusCanceled" },
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: "Payée",
  open: "En attente",
  uncollectible: "Impayée",
  void: "Annulée",
  draft: "Brouillon",
};

export default async function AbonnementPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/sign-in");
  if (!currentUser.tenant_id || currentUser.role !== "admin_tenant") {
    redirect("/org");
  }

  const supabase = createServiceRoleSupabaseClient();
  const [tenant, usage] = await Promise.all([getTenant(currentUser.tenant_id), getTenantUsage(supabase, currentUser.tenant_id)]);

  const planKey = tenant?.subscription_plan as PlanKey | null;
  // Offre attribuée par Ahead Digital depuis le super admin : ni paiement ni factures Stripe.
  const grantedByAhead = tenant?.plan_source === "manual" && !!planKey;
  const grantedUntil = grantedByAhead && tenant?.plan_ends_at ? new Date(tenant.plan_ends_at) : null;
  const plan = planKey && PLANS[planKey] ? PLANS[planKey] : null;
  const cancelScheduled = tenant?.subscription_status === "active" && tenant?.cancel_at_period_end;
  const status = cancelScheduled
    ? { label: "Annulation prévue", className: "statusPastDue" }
    : tenant?.subscription_status
      ? STATUS_LABEL[tenant.subscription_status]
      : null;

  let renewalDate: Date | null = null;
  // Prix réellement facturé par Stripe (le libellé de PLANS n'est qu'un repli).
  let billedPrice: string | null = null;
  let card: { brand: string; last4: string; expMonth: number; expYear: number } | null = null;
  let invoices: { id: string; number: string | null; created: number; amountPaid: number; currency: string; status: string | null; url: string | null }[] = [];

  try {
    // Abonnement et factures demandés à Stripe en parallèle.
    const [subscription, invoiceList] = await Promise.all([
      tenant?.stripe_subscription_id
        ? stripe.subscriptions.retrieve(tenant.stripe_subscription_id, { expand: ["default_payment_method"] })
        : null,
      tenant?.stripe_customer_id ? stripe.invoices.list({ customer: tenant.stripe_customer_id, limit: 5 }) : null,
    ]);

    if (subscription) {
      const item = subscription.items.data[0];
      if (item) {
        renewalDate = new Date(item.current_period_end * 1000);
        const price = item.price;
        if (price?.unit_amount != null && price.currency) {
          const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: price.currency.toUpperCase(), maximumFractionDigits: price.unit_amount % 100 ? 2 : 0 }).format(price.unit_amount / 100);
          const interval = price.recurring?.interval === "year" ? "an" : price.recurring?.interval === "month" ? "mois" : null;
          billedPrice = interval ? `${amount} / ${interval}` : amount;
        }
      }

      const pm = subscription.default_payment_method;
      if (pm && typeof pm === "object" && pm.card) {
        card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
      }
    }

    if (invoiceList) {
      invoices = invoiceList.data.map((inv, idx) => ({
        id: inv.id ?? inv.number ?? `invoice-${idx}`,
        number: inv.number,
        created: inv.created,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        status: inv.status,
        url: inv.hosted_invoice_url ?? inv.invoice_pdf ?? null,
      }));
    }
  } catch (err) {
    console.error("[abonnement] Stripe fetch error:", err);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Abonnement</h1>
      <p className={styles.subtitle}>
        {grantedByAhead ? "Offre attribuée par Ahead Digital. Contactez-nous pour la modifier." : "Géré via Stripe."}
      </p>

      <div className={styles.topRow}>
        <div className={styles.planCard}>
          <div className={styles.planCardHeader}>
            <span className={styles.planCardLabel}>Offre actuelle</span>
            {status && <span className={`${styles.statusBadge} ${styles[status.className]}`}>{status.label}</span>}
          </div>
          <h2 className={styles.planName}>{plan?.name ?? "Aucune offre active"}</h2>
          {plan && grantedByAhead && (
            <p className={styles.planPrice}>
              {grantedUntil
                ? `Accès jusqu'au ${grantedUntil.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`
                : "Sans date de fin"}
            </p>
          )}
          {plan && !grantedByAhead && (
            <p className={styles.planPrice}>
              {billedPrice ?? `${plan.price} ${plan.period}`}
              {renewalDate &&
                (cancelScheduled
                  ? ` · accès jusqu'au ${renewalDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}, non renouvelé`
                  : ` · renouvellement le ${renewalDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`)}
            </p>
          )}
          {cancelScheduled && (
            <p className={styles.cancelNotice}>
              Abonnement annulé — vous conservez l&apos;accès jusqu&apos;à la fin de la période déjà payée.
            </p>
          )}
          <div className={styles.planDivider} />
          <div className={styles.planStats}>
            <div className={styles.planStat}>
              <span className={styles.planStatValue}>
                {usage?.learners ?? 0}
                {usage?.learnerLimit != null && <span className={styles.planStatLimit}> / {usage.learnerLimit}</span>}
              </span>
              <span className={styles.planStatLabel}>
                apprenants{usage?.learnerLimit == null && plan ? " · illimité" : ""}
              </span>
            </div>
            <div className={styles.planStat}>
              <span className={styles.planStatValue}>
                {usage?.aiQuota === 0 ? "—" : usage?.aiFormationsThisMonth ?? 0}
                {usage?.aiQuota != null && usage.aiQuota > 0 && <span className={styles.planStatLimit}> / {usage.aiQuota}</span>}
              </span>
              <span className={styles.planStatLabel}>
                {usage?.aiQuota === 0
                  ? "création par IA non incluse"
                  : `formations IA ce mois-ci · renouvelé le ${nextQuotaResetLabel()}`}
              </span>
            </div>
            <div className={styles.planStat}>
              <span className={styles.planStatValue}>Illimité</span>
              <span className={styles.planStatLabel}>formations du catalogue Ahead</span>
            </div>
          </div>
        </div>

        {!grantedByAhead && (
        <div className={styles.paymentCard}>
          <span className={styles.paymentLabel}>Moyen de paiement</span>
          {card ? (
            <div className={styles.paymentInfo}>
              <CreditCard size={20} />
              <div>
                <p className={styles.paymentCardNumber}>
                  {card.brand.toUpperCase()} •••• {card.last4}
                </p>
                <p className={styles.paymentCardExpiry}>
                  expire {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                </p>
              </div>
            </div>
          ) : (
            <p className={styles.paymentEmpty}>Aucun moyen de paiement enregistré.</p>
          )}
          <ManageBillingButton />
        </div>
        )}
      </div>

      <h2 className={styles.sectionTitle}>Factures</h2>
      {invoices.length === 0 ? (
        <p className={styles.empty}>Aucune facture pour le moment.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Facture</th>
                <th>Date</th>
                <th>Montant</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div className={styles.invoiceCell}>
                      <FileText size={14} />
                      {inv.number ?? "—"}
                    </div>
                  </td>
                  <td className={styles.cellMuted}>
                    {new Date(inv.created * 1000).toLocaleDateString("fr-FR")}
                  </td>
                  <td className={styles.cellMuted}>
                    {(inv.amountPaid / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} {inv.currency.toUpperCase()}
                  </td>
                  <td>
                    <span className={`${styles.invoiceStatus} ${inv.status === "paid" ? styles.invoiceStatusPaid : ""}`}>
                      {inv.status ? INVOICE_STATUS_LABEL[inv.status] ?? inv.status : "—"}
                    </span>
                  </td>
                  <td className={styles.cellActions}>
                    {inv.url && (
                      <a href={inv.url} target="_blank" rel="noopener noreferrer" className={styles.downloadBtn}>
                        <Download size={14} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
