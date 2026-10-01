"use client";

import { LayoutDashboard, Users, CreditCard, Sparkles, Wand2, BarChart3 } from "lucide-react";
import WorkspaceShell, { WorkspaceIdentity, type WorkspaceNavItem } from "@/components/learner/WorkspaceShell";
import SubscriptionModal from "./SubscriptionModal";

const exact = (href: string) => (p: string) => p === href;
const prefix = (href: string) => (p: string) => p === href || p.startsWith(`${href}/`);

const baseNavItems: WorkspaceNavItem[] = [
  { href: "/org", label: "Tableau de bord", icon: LayoutDashboard, match: exact("/org") },
  { href: "/org/apprenants", label: "Apprenants", icon: Users, match: prefix("/org/apprenants") },
  { href: "/org/suivi", label: "Suivi", icon: BarChart3, match: prefix("/org/suivi") },
];

// "Formations" fusionne le catalogue Ahead et les formations créées par le
// tenant (voir app/(org)/org/formations/page.tsx) — plus d'entrée "Catalogue"
// séparée, elle induisait en erreur (une formation créée par le tenant n'y
// apparaissait jamais, donnant l'impression qu'elle avait disparu).
const adminOnlyNavItems: WorkspaceNavItem[] = [
  { href: "/org/formations", label: "Formations", icon: Wand2, match: (p) => p === "/org/formations" || (p.startsWith("/org/formations/") && !p.startsWith("/org/formations/new")) || p.startsWith("/org/catalogue") },
  { href: "/org/formations/new", label: "Générer une formation", icon: Sparkles, match: prefix("/org/formations/new") },
  { href: "/org/abonnement", label: "Abonnement", icon: CreditCard, match: prefix("/org/abonnement") },
];

interface Props {
  tenantName: string;
  tenantLogoUrl?: string | null;
  userRole: string;
  hasSubscription: boolean;
  children: React.ReactNode;
}

export default function OrgShell({ tenantName, tenantLogoUrl, userRole, hasSubscription, children }: Props) {
  const roleLabel = userRole === "tuteur" ? "Tuteur" : "Administrateur";
  const nav = userRole === "admin_tenant" ? [...baseNavItems, ...adminOnlyNavItems] : baseNavItems;

  return (
    <>
      {!hasSubscription && <SubscriptionModal />}
      <WorkspaceShell
        homeHref="/org"
        nav={nav}
        muted
        accountLinks={[{ href: "/org", label: "Tableau de bord" }]}
        identity={<WorkspaceIdentity name={tenantName} role={roleLabel} logoUrl={tenantLogoUrl} />}
      >
        {children}
      </WorkspaceShell>
    </>
  );
}
