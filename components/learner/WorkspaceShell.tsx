"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import NotificationBell from "@/components/shared/NotificationBell";
import AccountMenu from "./AccountMenu";
import AheadLearningLogo from "./AheadLearningLogo";
import styles from "./learnerShell.module.css";

export interface WorkspaceNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

/**
 * Cadre commun des espaces (apprenant, entreprise, super admin) : logo Ahead
 * Digital, éventuelle identité de l'espace, navigation à icônes, compte et
 * notifications en bas.
 */
export default function WorkspaceShell({
  homeHref,
  nav,
  identity,
  accountLinks,
  muted = false,
  children,
}: {
  homeHref: string;
  nav: WorkspaceNavItem[];
  /** Bloc sous le logo (entreprise, rôle). */
  identity?: React.ReactNode;
  accountLinks?: { href: string; label: string }[];
  /** Fond gris très clair pour les écrans d'administration en cartes. */
  muted?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.primaryEmailAddress?.emailAddress || null : null;

  return (
    <div className={styles.shell} data-muted={muted || undefined}>
      <aside className={styles.sidebar}>
        <Link href={homeHref} className={styles.logo}>
          <AheadLearningLogo size={38} />
        </Link>
        {identity}
        <nav aria-label="Navigation principale">
          <ol className={styles.nav}>
            {nav.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={styles.navItem} data-active={active || undefined} aria-current={active ? "page" : undefined}>
                    <item.icon size={19} strokeWidth={2} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className={styles.bottom}>
          <AccountMenu name={name} placement="above" links={accountLinks} />
          <NotificationBell />
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

/** Identité de l'espace sous le logo : avatar (logo ou initiale), nom, rôle. */
export function WorkspaceIdentity({ name, role, logoUrl }: { name: string; role: string; logoUrl?: string | null }) {
  return (
    <div className={styles.identity}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo hébergé par Clerk, pas un asset local
        <img src={logoUrl} alt="" className={styles.identityAvatar} />
      ) : (
        <span className={styles.identityAvatar} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      )}
      <span className={styles.identityText}>
        <span className={styles.identityName}>{name}</span>
        <span className={styles.identityRole}>{role}</span>
      </span>
    </div>
  );
}
