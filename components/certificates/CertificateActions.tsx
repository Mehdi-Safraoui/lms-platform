"use client";

import * as React from "react";
import { Download, ExternalLink, Link2, Check } from "lucide-react";
import styles from "./certificate.module.css";

/** Boutons d'un certificat : PDF, ajout au profil LinkedIn, copie du lien de vérification. */
export default function CertificateActions({
  pdfHref,
  linkedinHref,
  shareUrl,
}: {
  pdfHref: string;
  /** null = le visiteur n'est pas le titulaire (pas d'ajout LinkedIn proposé). */
  linkedinHref: string | null;
  shareUrl: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.actions}>
      <a href={pdfHref} target="_blank" rel="noopener noreferrer" className={styles.primary}>
        <Download size={15} />
        Télécharger le PDF
      </a>
      {linkedinHref && (
        <a href={linkedinHref} target="_blank" rel="noopener noreferrer" className={styles.secondary}>
          <ExternalLink size={15} />
          Ajouter à LinkedIn
        </a>
      )}
      <button type="button" className={styles.secondary} onClick={copy} aria-live="polite">
        {copied ? <Check size={15} /> : <Link2 size={15} />}
        {copied ? "Lien copié" : "Copier le lien de vérification"}
      </button>
    </div>
  );
}
