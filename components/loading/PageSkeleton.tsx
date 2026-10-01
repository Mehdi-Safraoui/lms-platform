import styles from "./PageSkeleton.module.css";

/**
 * Squelette affiché par les loading.tsx pendant le rendu serveur d'une page :
 * la navigation réagit immédiatement au clic (le menu reste en place), au lieu
 * de rester figée sur la page précédente jusqu'à la fin du chargement.
 */
export default function PageSkeleton() {
  return (
    <div className={styles.page} role="status" aria-label="Chargement de la page">
      <div className={`${styles.block} ${styles.eyebrow}`} />
      <div className={`${styles.block} ${styles.title}`} />
      <div className={`${styles.block} ${styles.subtitle}`} />
      <div className={styles.cards}>
        <div className={`${styles.block} ${styles.card}`} />
        <div className={`${styles.block} ${styles.card}`} />
        <div className={`${styles.block} ${styles.card}`} />
      </div>
      <div className={`${styles.block} ${styles.panel}`} />
    </div>
  );
}
