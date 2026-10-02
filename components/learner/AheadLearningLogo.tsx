import Image from "next/image";
import styles from "./aheadLearningLogo.module.css";

/**
 * Logo du produit Ahead Learning : la marque (un « a » sur un tronçon de
 * ligne de métro) et le nom. tone="dark" pour les fonds clairs (marque
 * marine), tone="light" pour les fonds marine (marque blanche).
 */
export default function AheadLearningLogo({ tone = "dark", size = 36 }: { tone?: "dark" | "light"; size?: number }) {
  return (
    <span className={styles.logo} data-tone={tone} style={{ "--mark": `${size}px` } as React.CSSProperties}>
      <Image
        src={tone === "light" ? "/brand/ahead-learning-mark-white.png" : "/brand/ahead-learning-mark.png"}
        alt=""
        width={size}
        height={size}
        className={styles.mark}
        priority
      />
      <span className={styles.name}>Ahead Learning</span>
    </span>
  );
}
