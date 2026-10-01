"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { ChevronDown, User } from "lucide-react";
import styles from "./account.module.css";

/** Compte de l'apprenant : avatar + nom, menu (formations, progression, compte, déconnexion). */
export default function AccountMenu({ name, placement = "below" }: { name: string | null; placement?: "below" | "above" }) {
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
          <Link href="/apprenant" role="menuitem" className={styles.item}>Mes formations</Link>
          <Link href="/apprenant/progression" role="menuitem" className={styles.item}>Ma progression</Link>
          <button type="button" role="menuitem" className={styles.item} onClick={() => clerk.openUserProfile()}>Mon compte</button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => clerk.signOut({ redirectUrl: "/sign-in" })}>Se déconnecter</button>
        </div>
      )}
    </div>
  );
}
