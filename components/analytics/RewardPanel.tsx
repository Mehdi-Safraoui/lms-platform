"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_REWARD_LABEL, MERIT_LABEL, type FormationReward, type MeritStatus } from "@/lib/merit";
import styles from "./analytics.module.css";

/**
 * Objectif au mérite d'une formation : score minimum aux quiz (premières
 * tentatives) pour obtenir une récompense, par exemple une licence Copilot.
 * L'admin entreprise le fixe ici ; le décompte par statut sert à décider.
 */
export default function RewardPanel({
  formationId,
  reward,
  counts,
  totalQuizzes,
  canEdit,
  exportHref,
}: {
  formationId: string;
  reward: FormationReward | null;
  counts: Record<MeritStatus, number>;
  totalQuizzes: number;
  canEdit: boolean;
  exportHref: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [minScore, setMinScore] = React.useState(String(reward?.minScorePct ?? 75));
  const [label, setLabel] = React.useState(reward?.rewardLabel ?? DEFAULT_REWARD_LABEL);
  const [saving, setSaving] = React.useState(false);

  if (!reward && !canEdit) return null;

  async function send(method: "PUT" | "DELETE") {
    setSaving(true);
    try {
      const res = await fetch(`/api/suivi/${formationId}/reward`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ minScorePct: Number(minScore), rewardLabel: label }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "L'objectif n'a pas été enregistré.");
      toast.success(method === "PUT" ? "Objectif enregistré." : "Objectif retiré.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'objectif n'a pas été enregistré.");
    } finally {
      setSaving(false);
    }
  }

  const form = (
    <form
      className={styles.rewardForm}
      onSubmit={(e) => {
        e.preventDefault();
        send("PUT");
      }}
    >
      <label className={styles.rewardField}>
        <span>Score minimum aux quiz</span>
        <span className={styles.rewardInputWrap}>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            required
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className={styles.rewardInput}
          />
          <span aria-hidden="true">%</span>
        </span>
      </label>
      <label className={`${styles.rewardField} ${styles.rewardFieldWide}`}>
        <span>Récompense obtenue</span>
        <input
          type="text"
          required
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={DEFAULT_REWARD_LABEL}
          className={styles.rewardInput}
        />
      </label>
      <div className={styles.rewardFormActions}>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {(reward || editing) && (
          <button type="button" className={styles.ghostBtn} onClick={() => setEditing(false)} disabled={saving}>
            Annuler
          </button>
        )}
        {reward && (
          <button type="button" className={styles.linkDangerBtn} onClick={() => send("DELETE")} disabled={saving}>
            Retirer l&apos;objectif
          </button>
        )}
      </div>
    </form>
  );

  return (
    <section className={styles.section} aria-labelledby="reward-title">
      <div className={styles.rewardCard}>
        <div className={styles.rewardHead}>
          <span className={styles.rewardIcon} aria-hidden="true"><Award size={22} strokeWidth={1.9} /></span>
          <div className={styles.rewardIntro}>
            <h2 id="reward-title" className={styles.sectionTitle}>Objectif au mérite</h2>
            {reward ? (
              <p className={styles.rewardSummary}>
                <strong>{reward.minScorePct} %</strong> aux quiz pour être éligible · récompense : <strong>{reward.rewardLabel}</strong>.
                Seule la première tentative de chaque quiz compte.
              </p>
            ) : (
              <p className={styles.rewardSummary}>
                Fixez un score minimum aux quiz : les apprenants qui l&apos;atteignent obtiennent une récompense, par exemple une licence Copilot.
                Seule la première tentative de chaque quiz compte, et l&apos;objectif est affiché aux apprenants.
              </p>
            )}
          </div>
          {reward && canEdit && !editing && (
            <button type="button" className={styles.ghostBtn} onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden="true" />
              Modifier
            </button>
          )}
        </div>

        {totalQuizzes === 0 ? (
          <p className={styles.rewardNote}>Cette formation n&apos;a pas de quiz : l&apos;objectif ne peut pas être calculé.</p>
        ) : !reward ? (
          editing ? form : (
            <div>
              <button type="button" className={styles.primaryBtn} onClick={() => setEditing(true)}>Définir un objectif</button>
            </div>
          )
        ) : editing ? (
          form
        ) : (
          <div className={styles.rewardStats}>
            <dl className={styles.rewardCounts}>
              {(Object.keys(MERIT_LABEL) as MeritStatus[]).map((s) => (
                <div key={s} className={styles.rewardCount} data-status={s}>
                  <dt>{MERIT_LABEL[s]}</dt>
                  <dd>{counts[s]}</dd>
                </div>
              ))}
            </dl>
            <a href={`${exportHref}?eligibles=1`} className={styles.exportBtn}>
              <Download size={15} aria-hidden="true" />
              Exporter les éligibles
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
