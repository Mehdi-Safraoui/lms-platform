import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreditCard, FileText, Download } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
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

  const { data: tenant } = await supabase
    .from("tenants")
    .select("subscription_plan, subscription_status, stripe_customer_id, stripe_subscription_id")
    .eq("id", currentUser.tenant_id)
    .single();

  const { count: apprenantCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", currentUser.tenant_id)
    .eq("role", "apprenant");

  const planKey = tenant?.subscription_plan as PlanKey | null;
  const plan = planKey && PLANS[planKey] ? PLANS[planKey] : null;
  const status = tenant?.subscription_status ? STATUS_LABEL[tenant.subscription_status] : null;

  let renewalDate: Date | null = null;
  let card: { brand: string; last4: string; expMonth: number; expYear: number } | null = null;
  let invoices: { id: string; number: string | null; created: number; amountPaid: number; currency: string; status: string | null; url: string | null }[] = [];

  try {
    if (tenant?.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id, {
        expand: ["default_payment_method"],
      });
      const item = subscription.items.data[0];
      if (item) renewalDate = new Date(item.current_period_end * 1000);

      const pm = subscription.default_payment_method;
      if (pm && typeof pm === "object" && pm.card) {
        card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
      }
    }

    if (tenant?.stripe_customer_id) {
      const invoiceList = await stripe.invoices.list({ customer: tenant.stripe_customer_id, limit: 5 });
      invoices = invoiceList.data.map((inv) => ({
        id: inv.id ?? inv.number ?? Math.random().toString(),
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
      <div className={styles.eyebrow}>
        <span className={styles.dot} />
        Facturation
      </div>
      <h1 className={styles.title}>Abonnement</h1>
      <p className={styles.subtitle}>Géré via Stripe · facturation en euros.</p>

      <div className={styles.topRow}>
        <div className={styles.planCard}>
          <div className={styles.planCardHeader}>
            <span className={styles.planCardLabel}>Offre actuelle</span>
            {status && <span className={`${styles.statusBadge} ${styles[status.className]}`}>{status.label}</span>}
          </div>
          <h2 className={styles.planName}>{plan?.name ?? "Aucune offre active"}</h2>
          {plan && (
            <p className={styles.planPrice}>
              {plan.price} {plan.period}
              {renewalDate && ` · renouvellement le ${renewalDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`}
            </p>
          )}
          <div className={styles.planDivider} />
          <div className={styles.planStats}>
            <div className={styles.planStat}>
              <span className={styles.planStatValue}>{apprenantCount ?? 0}</span>
              <span className={styles.planStatLabel}>apprenants</span>
            </div>
            <div className={styles.planStat}>
              <span className={styles.planStatValue}>Illimité</span>
              <span className={styles.planStatLabel}>formations</span>
            </div>
          </div>
        </div>

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
