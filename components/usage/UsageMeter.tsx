import { AlertTriangle } from "lucide-react";
import styles from "./usageMeter.module.css";

/**
 * Consommation « utilisé / limite » d'une entreprise : valeur, barre fine sur
 * piste de la même teinte, et mention « Limite atteinte » (icône + texte,
 * jamais la couleur seule). limit null = illimité, 0 = non inclus dans l'offre.
 */
export default function UsageMeter({ used, limit, noPlan = false }: { used: number; limit: number | null; noPlan?: boolean }) {
  if (noPlan) return <span className={styles.muted}>Aucune offre</span>;
  if (limit === 0) return <span className={styles.muted}>Non inclus</span>;

  const reached = limit !== null && used >= limit;
  return (
    <span className={styles.usage}>
      <span className={styles.value}>
        {used}
        <span className={styles.limit}>{limit === null ? " · illimité" : ` / ${limit}`}</span>
      </span>
      {limit !== null && (
        <span className={styles.meter} aria-hidden="true">
          <span className={styles.fill} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
        </span>
      )}
      {reached && (
        <span className={styles.reached}>
          <AlertTriangle size={11} />
          Limite atteinte
        </span>
      )}
    </span>
  );
}
