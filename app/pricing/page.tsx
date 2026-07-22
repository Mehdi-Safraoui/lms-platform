import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import CheckoutButton from "./CheckoutButton";
import styles from "./pricing.module.css";

export default function PricingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.logo}>Ahead</div>

      <div className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.dot} />
          Tarifs
        </div>
        <h1 className={styles.title}>Choisissez votre offre</h1>
        <p className={styles.subtitle}>
          Formez vos équipes avec les meilleures formations, sans engagement de durée.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Découverte */}
        <div className={styles.card}>
          <p className={styles.planName}>{PLANS.decouverte.name}</p>
          <p className={styles.planDesc}>{PLANS.decouverte.description}</p>
          <div className={styles.priceRow}>
            <span className={styles.priceAmount}>{PLANS.decouverte.price}</span>
            <span className={styles.pricePeriod}>{PLANS.decouverte.period}</span>
          </div>
          <div className={styles.divider} />
          <ul className={styles.featureList}>
            {PLANS.decouverte.features.map((f) => (
              <li key={f} className={styles.featureItem}>
                <Check className={styles.checkIcon} />
                {f}
              </li>
            ))}
          </ul>
          <CheckoutButton
            priceId={PLANS.decouverte.priceId}
            label="Commencer"
            variant="outline"
          />
        </div>

        {/* Création — mise en avant */}
        <div className={`${styles.card} ${styles.cardPopular}`}>
          <span className={styles.popularBadge}>Recommandé</span>
          <p className={styles.planName}>{PLANS.creation.name}</p>
          <p className={styles.planDesc}>{PLANS.creation.description}</p>
          <div className={styles.priceRow}>
            <span className={styles.priceAmount}>{PLANS.creation.price}</span>
            <span className={styles.pricePeriod}>{PLANS.creation.period}</span>
          </div>
          <div className={styles.divider} />
          <ul className={styles.featureList}>
            {PLANS.creation.features.map((f) => (
              <li key={f} className={styles.featureItem}>
                <Check className={styles.checkIcon} />
                {f}
              </li>
            ))}
          </ul>
          <CheckoutButton
            priceId={PLANS.creation.priceId}
            label="Souscrire"
            variant="primary"
          />
        </div>

        {/* Entreprise */}
        <div className={styles.card}>
          <p className={styles.planName}>{PLANS.entreprise.name}</p>
          <p className={styles.planDesc}>{PLANS.entreprise.description}</p>
          <div className={styles.priceRow}>
            <span className={styles.priceAmount}>{PLANS.entreprise.price}</span>
          </div>
          <div className={styles.divider} />
          <ul className={styles.featureList}>
            {PLANS.entreprise.features.map((f) => (
              <li key={f} className={styles.featureItem}>
                <Check className={styles.checkIcon} />
                {f}
              </li>
            ))}
          </ul>
          <CheckoutButton
            priceId={PLANS.entreprise.priceId}
            label="Nous contacter"
            variant="contact"
          />
        </div>
      </div>

      <Link href="/org" className={styles.backLink}>
        ← Retour au tableau de bord
      </Link>
    </div>
  );
}
