"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, X } from "lucide-react";
import styles from "./subscription-modal.module.css";

export default function SubscriptionModal() {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Fermer">
          <X size={16} />
        </button>

        <div className={styles.iconWrap}>
          <Sparkles size={26} strokeWidth={1.5} />
        </div>

        <h2 className={styles.title}>Débloquez votre espace Ahead</h2>

        <p className={styles.body}>
          Pour accéder au catalogue de formations, activer vos formations et
          suivre la progression de vos apprenants, vous devez souscrire à une offre.
        </p>

        <ul className={styles.features}>
          <li>
            <span className={styles.featureDot} />
            Accès au catalogue de formations IA
          </li>
          <li>
            <span className={styles.featureDot} />
            Gestion et suivi de vos apprenants
          </li>
          <li>
            <span className={styles.featureDot} />
            Tableau de bord et analytics
          </li>
        </ul>

        <button
          className={styles.ctaBtn}
          onClick={() => router.push("/pricing")}
        >
          Voir les offres
          <ArrowRight size={16} strokeWidth={2} />
        </button>

        <button className={styles.laterBtn} onClick={() => setOpen(false)}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
