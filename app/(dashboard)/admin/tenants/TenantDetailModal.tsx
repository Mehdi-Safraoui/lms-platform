"use client";

import { useEffect, useState } from "react";
import { X, Clock, BookOpen } from "lucide-react";
import styles from "./tenants.module.css";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  subscription_status: string | null;
  subscription_plan: string | null;
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

export default function TenantDetailModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [formationProgress, setFormationProgress] = useState<FormationProgress[]>([]);

  useEffect(() => {
    fetch(`/api/admin/tenants/${tenantId}`)
      .then((r) => r.json())
      .then((j) => {
        setTenant(j.tenant ?? null);
        setMembers(j.members ?? []);
        setPendingInvitations(j.pendingInvitations ?? []);
        setFormationProgress(j.formationProgress ?? []);
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.detailModal}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <p className={styles.modalTitle}>{tenant?.name ?? "Détail de l'entreprise"}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, marginTop: -2 }}>
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
              <span className={styles.detailSectionTitle}>Formations suivies ({formationProgress.length})</span>
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
                          Complétion moyenne sur {f.apprenantCount} apprenant{f.apprenantCount > 1 ? "s" : ""}
                        </span>
                        <div className={styles.formationProgressBar}>
                          <div className={styles.formationProgressFill} style={{ width: `${f.avgCompletionPct}%` }} />
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
                <span className={styles.detailSectionTitle}>Invitations en attente ({pendingInvitations.length})</span>
                <div className={styles.memberList}>
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className={styles.memberRow}>
                      <span className={`${styles.memberAvatar} ${styles.memberAvatarPending}`}>
                        <Clock size={14} />
                      </span>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{inv.emailAddress}</span>
                        <span className={styles.memberEmail}>{roleLabelFromClerkRole(inv.role)}</span>
                      </div>
                      <span className={`${styles.roleBadge} ${styles.roleBadgePending}`}>En attente</span>
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
