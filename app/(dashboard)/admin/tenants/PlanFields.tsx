"use client";

import { PLAN_KEYS, PLAN_LABEL } from "@/lib/manualPlans";
import styles from "./tenants.module.css";

/**
 * Choix d'une offre attribuée par Ahead : l'offre, et une date de fin
 * facultative (pilote, essai). plan "" = aucune offre attribuée.
 */
export default function PlanFields({
  idPrefix,
  plan,
  endsAt,
  onPlanChange,
  onEndsAtChange,
  emptyLabel,
}: {
  idPrefix: string;
  plan: string;
  endsAt: string;
  onPlanChange: (plan: string) => void;
  onEndsAtChange: (endsAt: string) => void;
  emptyLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className={styles.planFields}>
      <div>
        <label className={styles.label} htmlFor={`${idPrefix}-plan`}>Offre</label>
        <select id={`${idPrefix}-plan`} className={styles.input} value={plan} onChange={(e) => onPlanChange(e.target.value)}>
          <option value="">{emptyLabel}</option>
          {PLAN_KEYS.map((k) => (
            <option key={k} value={k}>{PLAN_LABEL[k]}</option>
          ))}
        </select>
      </div>
      {plan && (
        <div>
          <label className={styles.label} htmlFor={`${idPrefix}-ends`}>Fin de l&apos;offre (facultatif)</label>
          <input
            id={`${idPrefix}-ends`}
            type="date"
            min={today}
            className={styles.input}
            value={endsAt}
            onChange={(e) => onEndsAtChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
