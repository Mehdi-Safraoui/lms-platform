"use client";

import { useEffect, useState } from "react";
import { Plus, Building2, X } from "lucide-react";
import { toast } from "sonner";
import styles from "./tenants.module.css";
import TenantDetailModal from "./TenantDetailModal";
import PlanFields from "./PlanFields";
import { PLAN_LABEL, isPlanKey } from "@/lib/manualPlans";
import UsageMeter from "@/components/usage/UsageMeter";
import type { TenantUsageSummary } from "@/lib/tenantUsage";
import { formatUsd } from "@/lib/aiPricing";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  plan_source: "stripe" | "manual" | null;
  plan_ends_at: string | null;
  created_at: string;
  activeApprenantCount: number;
  followedFormationCount: number;
  usage: TenantUsageSummary | null;
  aiCostThisMonthUsd: number;
}

interface AiCostsOverview {
  totalUsd: number;
  catalogueUsd: number;
  unattributedUsd: number;
  unpricedModels: string[];
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "badgeActive" },
  trialing: { label: "Essai", className: "badgeActive" },
  past_due: { label: "Impayé", className: "badgePastDue" },
  canceled: { label: "Annulé", className: "badgeCanceled" },
};

function NewTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [plan, setPlan] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, adminEmail, plan: plan || null, endsAt: endsAt || null }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        toast.success("Entreprise créée", { description: `Invitation envoyée à ${adminEmail}.` });
        onCreated();
        onClose();
      } else {
        toast.error(data?.error ?? "Erreur lors de la création.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <p className={styles.modalTitle}>Inviter une nouvelle entreprise</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, marginTop: -2 }}>
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalText}>
          L&apos;entreprise est créée et son administrateur reçoit une invitation par email. Choisissez une offre pour l&apos;ouvrir sans paiement en ligne, ou laissez-la choisir et payer elle-même.
        </p>
        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="companyName">Nom de l&apos;entreprise</label>
          <input
            id="companyName"
            className={styles.input}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ex : EY"
            required
          />
          <label className={styles.label} htmlFor="adminEmail">Email de l&apos;administrateur</label>
          <input
            id="adminEmail"
            type="email"
            className={styles.input}
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@entreprise.com"
            required
          />
          <PlanFields
            idPrefix="new-tenant"
            plan={plan}
            endsAt={endsAt}
            onPlanChange={setPlan}
            onEndsAtChange={setEndsAt}
            emptyLabel="Aucune : l'entreprise choisit et paie en ligne"
          />
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? "Envoi…" : "Créer et inviter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [aiCosts, setAiCosts] = useState<AiCostsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  function fetchTenants() {
    fetch("/api/admin/tenants")
      .then((r) => r.json())
      .then((j) => {
        setTenants(j.tenants ?? []);
        setAiCosts(j.aiCosts ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchTenants();
  }, []);

  if (loading) return <div className={styles.loading}>Chargement…</div>;

  return (
    <>
      {modalOpen && (
        <NewTenantModal onClose={() => setModalOpen(false)} onCreated={fetchTenants} />
      )}

      {selectedTenantId && (
        <TenantDetailModal
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onChanged={fetchTenants}
        />
      )}

      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Entreprises</h1>
              <p className={styles.subtitle}>
                Toutes les entreprises clientes inscrites sur la plateforme.
              </p>
            </div>
            <button className={styles.btnCreate} onClick={() => setModalOpen(true)}>
              <Plus size={16} strokeWidth={2.5} />
              Inviter une entreprise
            </button>
          </div>
        </div>

        {aiCosts && (
          <div className={styles.costStrip}>
            <div className={styles.usageTile}>
              <span className={styles.usageTileLabel}>Coût IA ce mois-ci</span>
              <span className={styles.usageTileValue}>{formatUsd(aiCosts.totalUsd)}</span>
              <span className={styles.usageTileHint}>toutes entreprises et catalogue confondus</span>
            </div>
            <div className={styles.usageTile}>
              <span className={styles.usageTileLabel}>Entreprises clientes</span>
              <span className={styles.usageTileValue}>
                {formatUsd(aiCosts.totalUsd - aiCosts.catalogueUsd - aiCosts.unattributedUsd)}
              </span>
              <span className={styles.usageTileHint}>formations créées par IA et chat des apprenants</span>
            </div>
            <div className={styles.usageTile}>
              <span className={styles.usageTileLabel}>Catalogue Ahead</span>
              <span className={styles.usageTileValue}>{formatUsd(aiCosts.catalogueUsd)}</span>
              <span className={styles.usageTileHint}>
                formations créées par le super admin
                {aiCosts.unattributedUsd > 0 && ` · ${formatUsd(aiCosts.unattributedUsd)} non attribué`}
              </span>
            </div>
          </div>
        )}

        <div className={styles.tableWrap}>
          {tenants.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <Building2 size={24} strokeWidth={1.5} />
              </div>
              <p className={styles.emptyTitle}>Aucune entreprise cliente</p>
              <p className={styles.emptyText}>Invitez votre première entreprise pour commencer.</p>
              <button className={styles.btnCreate} style={{ display: "inline-flex" }} onClick={() => setModalOpen(true)}>
                <Plus size={16} strokeWidth={2.5} />
                Inviter une entreprise
              </button>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Offre</th>
                  <th>Statut</th>
                  <th>Apprenants</th>
                  <th>Formations IA ce mois</th>
                  <th>Générations IA</th>
                  <th>Coût IA ce mois</th>
                  <th>Formations suivies</th>
                  <th>Créée le</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const status = t.subscription_status ? STATUS_LABEL[t.subscription_status] : null;
                  return (
                    <tr
                      key={t.id}
                      className={styles.tableRow}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedTenantId(t.id)}
                    >
                      <td>
                        <div className={styles.tenantCell}>
                          <span className={styles.tenantIcon}>
                            <Building2 size={15} strokeWidth={1.75} />
                          </span>
                          <div className={styles.tenantInfo}>
                            <span className={styles.tenantName}>{t.name}</span>
                            <span className={styles.tenantSlug}>{t.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className={styles.cellMuted}>
                        {t.subscription_plan ? (
                          <>
                            {isPlanKey(t.subscription_plan) ? PLAN_LABEL[t.subscription_plan] : t.subscription_plan}
                            {t.plan_source === "manual" && (
                              <span className={styles.planSource}>
                                Attribuée par Ahead
                                {t.plan_ends_at && ` · jusqu'au ${new Date(t.plan_ends_at).toLocaleDateString("fr-FR")}`}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "var(--text-light)" }}>—</span>
                        )}
                      </td>
                      <td>
                        {status ? (
                          <span className={`${styles.badge} ${styles[status.className]}`}>{status.label}</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeNone}`}>Sans abonnement</span>
                        )}
                      </td>
                      <td title={`${t.activeApprenantCount} apprenant(s) actif(s)`}>
                        <UsageMeter used={t.usage?.learners ?? 0} limit={t.usage?.learnerLimit ?? null} noPlan={!t.subscription_plan} />
                      </td>
                      <td>
                        <UsageMeter used={t.usage?.aiFormationsThisMonth ?? 0} limit={t.usage?.aiQuota ?? null} noPlan={!t.subscription_plan} />
                      </td>
                      <td className={styles.cellMuted} title="Structures, leçons, quiz et régénérations, toutes formations confondues">
                        {t.usage?.totalAiGenerations ?? 0}
                      </td>
                      <td className={`${styles.cellMuted} ${styles.costValue}`} title="Tokens facturés par OpenAI et Voyage AI, aux tarifs publics">
                        {formatUsd(t.aiCostThisMonthUsd)}
                      </td>
                      <td className={styles.cellMuted}>{t.followedFormationCount}</td>
                      <td className={styles.cellMuted}>
                        {new Date(t.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
