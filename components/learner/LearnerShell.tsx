"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { GraduationCap, TrendingUp } from "lucide-react";
import NotificationBell from "@/components/shared/NotificationBell";
import AheadLogo from "./AheadLogo";
import AccountMenu from "./AccountMenu";
import styles from "./learnerShell.module.css";

const NAV = [
  { href: "/apprenant", label: "Mes formations", icon: GraduationCap, match: (p: string) => p === "/apprenant" || /^\/apprenant\/(?!progression)[^/]+\/?$/.test(p) },
  { href: "/apprenant/progression", label: "Ma progression", icon: TrendingUp, match: (p: string) => p.startsWith("/apprenant/progression") },
];

/**
 * Cadre des pages apprenant (hors page leçon, qui a son propre menu) : logo
 * Ahead Digital, deux entrées, le compte en bas.
 */
export default function LearnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.primaryEmailAddress?.emailAddress || null : null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/apprenant" className={styles.logo}>
          <AheadLogo width={164} />
        </Link>
        <nav aria-label="Espace apprenant">
          <ol className={styles.nav}>
            {NAV.map((item) => {
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
          <AccountMenu name={name} placement="above" />
          <NotificationBell />
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
