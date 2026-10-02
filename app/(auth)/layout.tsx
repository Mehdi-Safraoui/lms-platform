import AheadLogo from "@/components/learner/AheadLogo";
import styles from "./auth.module.css";

/**
 * Cadre des pages d'accès (connexion, inscription, invitation, création
 * d'entreprise) : à gauche la plaque Ahead Digital avec un tronçon de ligne
 * de métro, à droite le formulaire. Le widget Clerk prend son apparence de
 * lib/clerkAppearance.ts.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.panel}>
        <AheadLogo width={150} className={styles.logo} />

        <div className={styles.pitch}>
          <p className={styles.headline}>Apprenez l&apos;IA à votre rythme, une station après l&apos;autre.</p>
          <p className={styles.lead}>
            Ahead Learning : des parcours courts, des quiz pour ancrer chaque notion et un certificat au terminus.
          </p>
        </div>

        {/* Tronçon de ligne : décor, la signalétique du reste de l'app. */}
        <svg className={styles.line} viewBox="0 0 360 64" aria-hidden="true">
          <line x1="14" y1="24" x2="346" y2="24" stroke="#1d46e5" strokeWidth="6" strokeLinecap="round" />
          <circle cx="14" cy="24" r="9" fill="#1d46e5" />
          <circle cx="97" cy="24" r="9" fill="#17183b" stroke="#ffffff" strokeWidth="4" />
          <circle cx="97" cy="24" r="15" fill="none" stroke="#ff555b" strokeWidth="3" />
          <circle cx="180" cy="24" r="9" fill="#17183b" stroke="#7d93f0" strokeWidth="4" />
          <circle cx="263" cy="24" r="9" fill="#17183b" stroke="#7d93f0" strokeWidth="4" />
          <rect x="333" y="11" width="26" height="26" rx="6" fill="#ffffff" />
          <path d="M341 18v13M341 18h9l-2 3 2 3h-9" fill="none" stroke="#17183b" strokeWidth="2" strokeLinejoin="round" />
          <text x="97" y="58" textAnchor="middle" className={styles.here}>Vous êtes ici</text>
        </svg>

        <p className={styles.footer}>© {new Date().getFullYear()} Ahead Digital</p>
      </aside>

      <main className={styles.main}>
        <div className={styles.form}>{children}</div>
      </main>
    </div>
  );
}
