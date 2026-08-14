import Link from "next/link";
import { Sparkles } from "lucide-react";
import styles from "./upgradeNotice.module.css";

export default function UpgradeNotice() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon}>
        <Sparkles size={22} strokeWidth={1.75} />
      </div>
      <h2 className={styles.title}>Réservé aux offres Création et Entreprise</h2>
      <p className={styles.text}>
        La génération de formation par IA à partir de vos propres documents n&apos;est pas incluse
        dans l&apos;offre Découverte. Passez à l&apos;offre Création pour en profiter.
      </p>
      <Link href="/org/abonnement" className={styles.cta}>Voir les offres</Link>
    </div>
  );
}
