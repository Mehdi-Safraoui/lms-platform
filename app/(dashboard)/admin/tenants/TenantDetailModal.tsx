"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Clock, BookOpen, Link2 } from "lucide-react";
import { toast } from "sonner";
import PlanFields from "./PlanFields";
import { PLAN_LABEL, isPlanKey } from "@/lib/manualPlans";
import styles from "./tenants.module.css";
import UsageMeter from "@/components/usage/UsageMeter";
import type { TenantUsage } from "@/lib/tenantUsage";
import type { TenantAiCosts } from "@/lib/aiCosts";
import { formatUsd } from "@/lib/aiPricing";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  plan_source: "stripe" | "manual" | null;
  plan_ends_at: string | null;
  hasStripeSubscription: boolean;
  created_at: string;
}

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  emailAddress: string;
  role: string;
  createdAt: number;
  url: string | null;
}

interface FormationProgress {
  formationId: string;
  title: string;
  apprenantCount: number;
  avgCompletionPct: number;
}

const ROLE_LABEL: Record<string, string> = {
  admin_tenant: "Administrateur",
  tuteur: "Tuteur",
  formateur: "Formateur",
  apprenant: "Apprenant",
};

function roleLabelFromClerkRole(clerkRole: string): string {
  return clerkRole === "org:admin" ? "Administrateur" : "Membre";
}

/** Date ISO → valeur d'un champ date (AAAA-MM-JJ), en heure de Paris. */
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }) : "";
}

export default function TenantDetailModal({
  tenantId,
  onClose,
  onChanged,
}: {
  tenantId: string;
  onClose: () => void;
  /** Rafraîchit la liste des entreprises après un changement d'offre. */
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [formationProgress, setFormationProgress] = useState<FormationProgress[]>([]);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [aiCosts, setAiCosts] = useState<TenantAiCosts | null>(null);

  const [plan, setPlan] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "apprenant">("admin");
  const [inviting, setInviting] = useState(false);
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch(`/api/admin/tenants/${tenantId}`)
      .then((r) => r.json())
      .then((j) => {
        setTenant(j.tenant ?? null);
        setPlan(j.tenant?.subscription_plan ?? "");
        setEndsAt(toDateInput(j.tenant?.plan_ends_at ?? null));
        setMembers(j.members ?? []);
        setPendingInvitations(j.pendingInvitations ?? []);
        setFormationProgress(j.formationProgress ?? []);
        setUsage(j.usage ?? null);
        setAiCosts(j.aiCosts ?? null);
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function savePlan() {
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan || null, endsAt: endsAt || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "L'offre n'a pas été changée.");
      toast.success(plan ? `Offre ${isPlanKey(plan) ? PLAN_LABEL[plan] : plan} attribuée.` : "Offre retirée.");
      await load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'offre n'a pas été changée.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "L'invitation n'a pas été envoyée.");
      toast.success("Invitation envoyée.", { description: inviteEmail });
      setInviteEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'invitation n'a pas été envoyée.");
    } finally {
      setInviting(false);
    }
  }

  async function copyInvitationLink(inv: PendingInvitation) {
    if (!inv.url) return toast.error("Lien indisponible pour cette invitation.");
    try {
      await navigator.clipboard.writeText(inv.url);
      toast.success("Lien d'invitation copié.", { description: inv.emailAddress });
    } catch {
      toast.error("Copie impossible. Autorisez l'accès au presse-papiers.");
    }
  }

  async function revokeInvitation(inv: PendingInvitation) {
    setBusyInvitation(inv.id);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/invitations/${inv.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "L'invitation n'a pas été annulée.");
      toast.success("Invitation annulée.", { description: inv.emailAddress });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'invitation n'a pas été annulée.");
    } finally {
      setBusyInvitation(null);
    }
  }

  // Une entreprise qui paie en ligne change d'offre depuis Stripe, pas ici.
  const paysOnline =
    !!tenant && tenant.plan_source !== "manual" && tenant.hasStripeSubscription &&
    ["active", "trialing", "past_due"].includes(tenant.subscription_status ?? "");
  const planChanged =
    !!tenant && (plan !== (tenant.subscription_plan ?? "") || endsAt !== toDateInput(tenant.plan_ends_at));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.detailModal}`} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <p className={styles.modalTitle}>{tenant?.name ?? "Détail de l'entreprise"}</p>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 4,
              marginTop: -2,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className={styles.modalText}>Chargement…</p>
        ) : !tenant ? (
          <p className={styles.modalText}>Entreprise introuvable.</p>
        ) : (
          <>
            <p className={styles.detailMeta}>
              {tenant.slug} · Créé le {new Date(tenant.created_at).toLocaleDateString("fr-FR")}
            </p>

            <div className={styles.detailSection}>
              <span className={styles.detailSectionTitle}>Offre</span>
              <p className={styles.planSummary}>
                {tenant.subscription_plan
                  ? `${isPlanKey(tenant.subscription_plan) ? PLAN_LABEL[tenant.subscription_plan] : tenant.subscription_plan} · `
                  : "Aucune offre · "}
                {tenant.plan_source === "manual"
                  ? `attribuée par Ahead${tenant.plan_ends_at ? `, jusqu'au ${new Date(tenant.plan_ends_at).toLocaleDateString("fr-FR")}` : ", sans date de fin"}`
                  : tenant.hasStripeSubscription
                    ? "payée en ligne via Stripe"
                    : "l'entreprise peut choisir et payer en ligne"}
              </p>
              {paysOnline ? (
                <p className={styles.detailEmpty}>
                  Cette entreprise paie son abonnement en ligne : son offre se change depuis Stripe.
                </p>
              ) : (
                <>
                  <PlanFields
                    idPrefix={`tenant-${tenant.id}`}
                    plan={plan}
                    endsAt={endsAt}
                    onPlanChange={setPlan}
                    onEndsAtChange={setEndsAt}
                    emptyLabel="Aucune offre attribuée"
                  />
                  <div className={styles.inlineActions}>
                    <button type="button" className={styles.btnSubmit} onClick={savePlan} disabled={!planChanged || savingPlan}>
                      {savingPlan ? "Enregistrement…" : "Enregistrer l'offre"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {usage && (
              <div className={styles.detailSection}>
                <span className={styles.detailSectionTitle}>Consommation</span>
                <div className={styles.usageTiles}>
                  <div className={styles.usageTile}>
                    <span className={styles.usageTileLabel}>Apprenants</span>
                    <UsageMeter
                      used={usage.learners}
                      limit={usage.learnerLimit}
                      noPlan={!usage.plan}
                    />
                    {pendingInvitations.length > 0 && (
                      <span className={styles.usageTileHint}>
                        + {pendingInvitations.length} invitation
                        {pendingInvitations.length > 1 ? "s" : ""} en attente
                      </span>
                    )}
                  </div>
                  <div className={styles.usageTile}>
                    <span className={styles.usageTileLabel}>Formations IA ce mois-ci</span>
                    <UsageMeter
                      used={usage.aiFormationsThisMonth}
                      limit={usage.aiQuota}
                      noPlan={!usage.plan}
                    />
                  </div>
                  <div className={styles.usageTile}>
                    <span className={styles.usageTileLabel}>Générations IA (total)</span>
                    <span className={styles.usageTileValue}>{usage.totalAiGenerations}</span>
                    <span className={styles.usageTileHint}>
                      structures, leçons, quiz, régénérations
                    </span>
                  </div>
                </div>

                {(() => {
                  const max = Math.max(1, ...usage.history.map((h) => h.count));
                  return (
                    <>
                      <span className={styles.usageChartTitle}>
                        Formations IA démarrées par mois
                      </span>
                      <div
                        className={styles.usageChart}
                        role="img"
                        aria-label={`Formations IA démarrées par mois : ${usage.history.map((h) => `${h.label} ${h.count}`).join(", ")}`}
                      >
                        {usage.history.map((h) => (
                          <div
                            key={h.month}
                            className={styles.usageCol}
                            title={`${h.label} : ${h.count} formation${h.count > 1 ? "s" : ""} IA démarrée${h.count > 1 ? "s" : ""}`}
                          >
                            <span className={styles.usageColValue}>{h.count}</span>
                            <span className={styles.usageColTrack}>
                              <span
                                className={styles.usageColBar}
                                style={{ height: `${(h.count / max) * 100}%` }}
                              />
                            </span>
                            <span className={styles.usageColLabel}>{h.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {usage.aiFormations.length === 0 ? (
                  <p className={styles.detailEmpty}>
                    Aucune formation créée par IA pour le moment.
                  </p>
                ) : (
                  <div className={styles.memberList}>
                    {usage.aiFormations.map((f) => (
                      <div key={f.id} className={styles.memberRow}>
                        <div className={styles.memberInfo}>
                          <span className={styles.memberName}>{f.title}</span>
                          <span className={styles.memberEmail}>
                            Démarrée le {new Date(f.startedAt).toLocaleDateString("fr-FR")} ·{" "}
                            {f.isPublished ? "publiée" : "brouillon"}
                          </span>
                        </div>
                        <span className={styles.roleBadge}>
                          {f.generationCount} génération{f.generationCount > 1 ? "s" : ""}
                          {aiCosts?.byFormation[f.id] ? ` · ${formatUsd(aiCosts.byFormation[f.id])}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {aiCosts && (
              <div className={styles.detailSection}>
                <span className={styles.detailSectionTitle}>Coût IA</span>
                <div className={`${styles.usageTiles} ${styles.usageTilesTwo}`}>
                  <div className={styles.usageTile}>
                    <span className={styles.usageTileLabel}>Ce mois-ci</span>
                    <span className={styles.usageTileValue}>{formatUsd(aiCosts.thisMonthUsd)}</span>
                  </div>
                  <div className={styles.usageTile}>
                    <span className={styles.usageTileLabel}>6 derniers mois</span>
                    <span className={styles.usageTileValue}>{formatUsd(aiCosts.sixMonthsUsd)}</span>
                  </div>
                </div>

                {(() => {
                  const max = Math.max(0.000001, ...aiCosts.history.map((h) => h.usd));
                  return (
                    <>
                      <span className={styles.usageChartTitle}>Coût IA par mois</span>
                      <div
                        className={styles.usageChart}
                        role="img"
                        aria-label={`Coût IA par mois : ${aiCosts.history.map((h) => `${h.label} ${formatUsd(h.usd)}`).join(", ")}`}
                      >
                        {aiCosts.history.map((h) => (
                          <div key={h.month} className={styles.usageCol} title={`${h.label} : ${formatUsd(h.usd)}`}>
                            <span className={styles.usageColValue}>{h.usd ? formatUsd(h.usd) : "—"}</span>
                            <span className={styles.usageColTrack}>
                              {h.usd > 0 && (
                                <span className={styles.usageColBar} style={{ height: `${(h.usd / max) * 100}%` }} />
                              )}
                            </span>
                            <span className={styles.usageColLabel}>{h.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <span className={styles.usageChartTitle}>Détail du mois en cours</span>
                {aiCosts.byFeature.length === 0 ? (
                  <p className={styles.detailEmpty}>Aucun appel IA ce mois-ci.</p>
                ) : (
                  <div className={styles.memberList}>
                    {aiCosts.byFeature.map((f) => (
                      <div key={f.feature} className={styles.memberRow}>
                        <div className={styles.memberInfo}>
                          <span className={styles.memberName}>{f.label}</span>
                          <span className={styles.memberEmail}>
                            {f.calls.toLocaleString("fr-FR")} appel{f.calls > 1 ? "s" : ""} ·{" "}
                            {f.tokens.toLocaleString("fr-FR")} tokens
                          </span>
                        </div>
                        <span className={styles.roleBadge}>{formatUsd(f.usd)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className={styles.costNote}>
                  Calculé à partir des tokens réellement facturés par OpenAI et Voyage AI à chaque appel,
                  aux tarifs publics en dollars. Suivi depuis le 1er octobre 2026.
                  {aiCosts.unpricedModels.length > 0 &&
                    ` Modèle sans tarif connu, compté à 0 : ${aiCosts.unpricedModels.join(", ")}.`}
                </p>
              </div>
            )}

            <div className={styles.detailSection}>
              <span className={styles.detailSectionTitle}>Inviter quelqu&apos;un</span>
              <form className={styles.inviteForm} onSubmit={invite}>
                <input
                  type="email"
                  required
                  className={styles.input}
                  placeholder="prenom.nom@entreprise.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  aria-label="Email de la personne à inviter"
                />
                <select
                  className={styles.input}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "apprenant")}
                  aria-label="Rôle"
                >
                  <option value="admin">Administrateur</option>
                  <option value="apprenant">Apprenant</option>
                </select>
                <button type="submit" className={styles.btnSubmit} disabled={inviting}>
                  {inviting ? "Envoi…" : "Inviter"}
                </button>
              </form>
            </div>

            <div className={styles.detailSection}>
              <span className={styles.detailSectionTitle}>Membres ({members.length})</span>
              {members.length === 0 ? (
                <p className={styles.detailEmpty}>Aucun membre pour le moment.</p>
              ) : (
                <div className={styles.memberList}>
                  {members.map((m) => (
                    <div key={m.id} className={styles.memberRow}>
                      <span className={styles.memberAvatar}>
                        {(m.full_name || m.email).charAt(0).toUpperCase()}
                      </span>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{m.full_name || m.email}</span>
                        <span className={styles.memberEmail}>{m.email}</span>
                      </div>
                      <span className={styles.roleBadge}>{ROLE_LABEL[m.role] ?? m.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.detailSection}>
              <span className={styles.detailSectionTitle}>
                Formations suivies ({formationProgress.length})
              </span>
              {formationProgress.length === 0 ? (
                <p className={styles.detailEmpty}>Aucune formation activée par cette entreprise.</p>
              ) : (
                <div className={styles.memberList}>
                  {formationProgress.map((f) => (
                    <div key={f.formationId} className={styles.formationRow}>
                      <span className={styles.memberAvatar}>
                        <BookOpen size={14} />
                      </span>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{f.title}</span>
                        <span className={styles.memberEmail}>
                          Complétion moyenne sur {f.apprenantCount} apprenant
                          {f.apprenantCount > 1 ? "s" : ""}
                        </span>
                        <div className={styles.formationProgressBar}>
                          <div
                            className={styles.formationProgressFill}
                            style={{ width: `${f.avgCompletionPct}%` }}
                          />
                        </div>
                      </div>
                      <span className={styles.formationPct}>{f.avgCompletionPct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pendingInvitations.length > 0 && (
              <div className={styles.detailSection}>
                <span className={styles.detailSectionTitle}>
                  Invitations en attente ({pendingInvitations.length})
                </span>
                <div className={styles.memberList}>
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className={styles.memberRow}>
                      <span className={`${styles.memberAvatar} ${styles.memberAvatarPending}`}>
                        <Clock size={14} />
                      </span>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{inv.emailAddress}</span>
                        <span className={styles.memberEmail}>
                          {roleLabelFromClerkRole(inv.role)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => copyInvitationLink(inv)}
                        title="Copier le lien d'invitation"
                        aria-label={`Copier le lien d'invitation de ${inv.emailAddress}`}
                      >
                        <Link2 size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => revokeInvitation(inv)}
                        disabled={busyInvitation === inv.id}
                        title="Annuler l'invitation"
                        aria-label={`Annuler l'invitation de ${inv.emailAddress}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
