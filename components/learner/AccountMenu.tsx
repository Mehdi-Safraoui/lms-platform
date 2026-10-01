"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { ChevronDown, User } from "lucide-react";
import styles from "./account.module.css";

const LEARNER_LINKS = [
  { href: "/apprenant", label: "Mes formations" },
  { href: "/apprenant/progression", label: "Ma progression" },
];

/** Compte connecté : avatar + nom, menu (liens de l'espace, compte, déconnexion). */
export default function AccountMenu({
  name,
  placement = "below",
  links = LEARNER_LINKS,
}: {
  name: string | null;
  placement?: "below" | "above";
  links?: { href: string; label: string }[];
}) {
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={styles.account} ref={ref}>
      <button type="button" className={styles.accountBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className={styles.avatar} aria-hidden="true">
          <User size={18} strokeWidth={2.2} />
        </span>
        <span className={styles.name}>{name ?? "Mon compte"}</span>
        <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.menu} data-placement={placement} role="menu">
          {links.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" className={styles.item}>{l.label}</Link>
          ))}
          <button type="button" role="menuitem" className={styles.item} onClick={() => clerk.openUserProfile()}>Mon compte</button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => clerk.signOut({ redirectUrl: "/sign-in" })}>Se déconnecter</button>
        </div>
      )}
    </div>
  );
}
