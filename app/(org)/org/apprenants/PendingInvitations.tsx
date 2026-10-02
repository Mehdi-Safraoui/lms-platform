"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Mail, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import type { PendingInvitation } from "@/lib/orgInvitations";
import styles from "./apprenants.module.css";

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Invitations envoyées mais pas encore acceptées. Si l'email n'arrive pas
 * (filtre antispam de l'entreprise invitée), l'admin peut copier le lien pour
 * le transmettre lui-même, renvoyer un nouvel email ou annuler l'invitation.
 */
export default function PendingInvitations({ invitations }: { invitations: PendingInvitation[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // La demande de confirmation d'annulation retombe d'elle-même.
  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmId]);

  if (invitations.length === 0) return null;

  async function copyLink(inv: PendingInvitation) {
    if (!inv.url) {
      toast.error("Lien indisponible pour cette invitation. Renvoyez-la pour en obtenir un nouveau.");
      return;
    }
    try {
      await navigator.clipboard.writeText(inv.url);
      toast.success("Lien d'invitation copié.", { description: `À transmettre à ${inv.email}, par Teams ou par email.` });
    } catch {
      toast.error("Copie impossible. Autorisez l'accès au presse-papiers puis réessayez.");
    }
  }

  async function act(inv: PendingInvitation, method: "POST" | "DELETE") {
    setBusyId(inv.id);
    setConfirmId(null);
    try {
      const res = await fetch(`/api/org/apprenants/invitations/${inv.id}`, { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "L'action n'a pas abouti.");
      toast.success(method === "POST" ? "Invitation renvoyée." : "Invitation annulée.", { description: inv.email });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'action n'a pas abouti.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.invitations} aria-labelledby="pending-invitations-title">
      <div className={styles.invitationsHead}>
        <h2 id="pending-invitations-title" className={styles.sectionTitle}>Invitations en attente</h2>
        <p className={styles.sectionHint}>
          Ces personnes n&apos;ont pas encore accepté. Si l&apos;email n&apos;arrive pas, copiez le lien et envoyez-le-leur directement.
        </p>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Personne invitée</th>
              <th>Envoyée le</th>
              <th>Expire le</th>
              <th><span className="srOnly">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => {
              const busy = busyId === inv.id;
              return (
                <tr key={inv.id}>
                  <td>
                    <div className={styles.apprenantCell}>
                      <div className={styles.avatarPending} aria-hidden="true"><Mail size={15} strokeWidth={2} /></div>
                      <div className={styles.invitedCell}>
                        <span className={styles.apprenantName}>{inv.email}</span>
                        <span className={`${styles.statusBadge} ${styles.statusPending}`}>En attente</span>
                      </div>
                    </div>
                  </td>
                  <td><span className={styles.dateCell}>{formatDate(inv.createdAt)}</span></td>
                  <td><span className={styles.dateCell}>{formatDate(inv.expiresAt)}</span></td>
                  <td>
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.btnGhost} onClick={() => copyLink(inv)} disabled={busy}>
                        <Link2 size={14} strokeWidth={2} aria-hidden="true" />
                        Copier le lien
                      </button>
                      <button type="button" className={styles.btnGhost} onClick={() => act(inv, "POST")} disabled={busy}>
                        <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
                        {busy ? "Envoi…" : "Renvoyer"}
                      </button>
                      {confirmId === inv.id ? (
                        <button
                          type="button"
                          className={`${styles.btnGhost} ${styles.btnDanger}`}
                          onClick={() => act(inv, "DELETE")}
                          disabled={busy}
                          aria-label={`Confirmer l'annulation de l'invitation de ${inv.email}`}
                        >
                          Annuler ?
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.btnGhost} ${styles.btnIcon}`}
                          onClick={() => setConfirmId(inv.id)}
                          disabled={busy}
                          aria-label={`Annuler l'invitation de ${inv.email}`}
                          title="Annuler l'invitation"
                        >
                          <X size={15} strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
