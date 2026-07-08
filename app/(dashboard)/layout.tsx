"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { BookOpen, Building2 } from "lucide-react";
import { Toaster } from "sonner";
import styles from "./layout.module.css";

const navItems = [
  { href: "/admin/catalog", label: "Catalogue IA", icon: BookOpen },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L14 13H2L8 2Z" fill="white" strokeWidth="0" />
            </svg>
          </div>
          <span className={styles.logoText}>ahead<span>.</span></span>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <span className={styles.navSection}>Super-admin</span>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname.startsWith(item.href) ? styles.active : ""}`}
            >
              <item.icon size={17} strokeWidth={1.75} />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className={styles.sidebarBottom}>
          <UserButton
            appearance={{
              elements: { avatarBox: { width: 30, height: 30 } },
            }}
          />
          <span className={styles.sidebarUser}>Mon compte</span>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.topbarBadge}>Super-admin</span>
          </div>
          <div className={styles.topbarRight} />
        </header>
        <div className={styles.content}>{children}</div>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font-jakarta), sans-serif",
            fontSize: "14px",
            fontWeight: "500",
            borderRadius: "12px",
            background: "#191738",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(11,10,34,0.35)",
          },
          duration: 3500,
        }}
      />
    </div>
  );
}
