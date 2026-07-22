"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { LayoutDashboard, Users, BookOpen } from "lucide-react";
import styles from "./layout.module.css";
import SubscriptionModal from "./SubscriptionModal";
import NotificationBell from "@/components/shared/NotificationBell";

const orgNavItems = [
  { href: "/org", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/org/catalogue", label: "Catalogue", icon: BookOpen, exact: false },
  { href: "/org/apprenants", label: "Apprenants", icon: Users, exact: false },
];

interface Props {
  tenantName: string;
  userRole: string;
  hasSubscription: boolean;
  children: React.ReactNode;
}

export default function OrgShell({ tenantName, userRole, hasSubscription, children }: Props) {
  const pathname = usePathname();
  const { user } = useUser();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.primaryEmailAddress?.emailAddress
    : null;
  const roleLabel = userRole === "tuteur" ? "Tuteur" : "Administrateur";

  return (
    <div className={styles.shell}>
      {!hasSubscription && <SubscriptionModal />}
      <aside className={styles.sidebar}>
        {/* Logo Ahead */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L14 13H2L8 2Z" fill="white" strokeWidth="0" />
            </svg>
          </div>
          <span className={styles.logoText}>ahead<span>·</span><em>digital</em></span>
        </div>

        {/* Tenant identity */}
        <div className={styles.tenantBlock}>
          <div className={styles.tenantAvatar}>{tenantName.charAt(0).toUpperCase()}</div>
          <div className={styles.tenantInfo}>
            <span className={styles.tenantName}>{tenantName}</span>
            <span className={styles.tenantRole}>{roleLabel}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <span className={styles.navSection}>Menu</span>
          {orgNavItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              >
                <item.icon size={17} strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={styles.sidebarBottom}>
          <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
          <span className={styles.sidebarUser}>{displayName ?? "Mon compte"}</span>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.topbarBadge}>{tenantName}</span>
          </div>
          <div className={styles.topbarRight}>
            <NotificationBell />
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
