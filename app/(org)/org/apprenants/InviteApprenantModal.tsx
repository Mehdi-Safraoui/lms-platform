"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { X } from "lucide-react";
import { toast } from "sonner";
import styles from "./apprenants.module.css";

export default function InviteApprenantModal({ onClose }: { onClose: () => void }) {
  const { organization } = useOrganization();
  const [emails, setEmails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    const emailAddresses = emails
      .split(/[,\n]/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (emailAddresses.length === 0) {
      toast.error("Entrez au moins une adresse email.");
      return;
    }

    setSubmitting(true);
    try {
      await organization.inviteMembers({ emailAddresses, role: "org:member" });
      toast.success(
        emailAddresses.length > 1 ? "Invitations envoyées." : "Invitation envoyée.",
        { description: emailAddresses.join(", ") }
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi des invitations.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <p className={styles.modalTitle}>Ajouter un apprenant</p>
          <button className={styles.modalClose} onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalText}>
          Ajoutez les adresses email des nouveaux membres de votre équipe, séparées par une virgule ou un retour à la ligne. Ils recevront une invitation par email.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="nouveau@entreprise.com, autre@entreprise.com"
            rows={4}
          />
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? "Envoi…" : "Envoyer les invitations"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
