"use client";

import { usePathname } from "next/navigation";
import { BookOpen, Building2, LayoutDashboard, Users } from "lucide-react";
import { Toaster } from "sonner";
import LearnerShell from "@/components/learner/LearnerShell";
import WorkspaceShell, { WorkspaceIdentity, type WorkspaceNavItem } from "@/components/learner/WorkspaceShell";

const prefix = (href: string) => (p: string) => p === href || p.startsWith(`${href}/`);

const ADMIN_NAV: WorkspaceNavItem[] = [
  { href: "/admin", label: "Vue globale", icon: LayoutDashboard, match: (p) => p === "/admin" },
  { href: "/admin/catalog", label: "Catalogue IA", icon: BookOpen, match: prefix("/admin/catalog") },
  { href: "/admin/tenants", label: "Entreprises", icon: Building2, match: prefix("/admin/tenants") },
];

const TUTEUR_NAV: WorkspaceNavItem[] = [
  { href: "/tuteur/apprenants", label: "Apprenants", icon: Users, match: prefix("/tuteur/apprenants") },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApprenant = pathname.startsWith("/apprenant");
  // Page leçon (/apprenant/[formation]/[leçon]) : plein écran, la page dessine
  // elle-même son menu (la ligne de la formation) et sa barre « Prochaine station ».
  const isLessonPage = /^\/apprenant\/[^/]+\/[^/]+\/?$/.test(pathname);
  const isTuteur = pathname.startsWith("/tuteur");

  const toaster = (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: "var(--font-text), sans-serif",
          fontSize: "14px",
          fontWeight: "600",
          borderRadius: "12px",
          background: "#17183b",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(11,10,34,0.35)",
        },
        duration: 3500,
      }}
    />
  );

  if (isLessonPage) {
    return (
      <>
        {children}
        {toaster}
      </>
    );
  }

  if (isApprenant) {
    return (
      <>
        <LearnerShell>{children}</LearnerShell>
        {toaster}
      </>
    );
  }

  return (
    <>
      <WorkspaceShell
        homeHref={isTuteur ? "/tuteur/apprenants" : "/admin"}
        nav={isTuteur ? TUTEUR_NAV : ADMIN_NAV}
        muted
        accountLinks={isTuteur ? [] : [{ href: "/admin", label: "Vue globale" }]}
        identity={<WorkspaceIdentity name="Ahead Digital" role={isTuteur ? "Tuteur" : "Super admin"} />}
      >
        {children}
      </WorkspaceShell>
      {toaster}
    </>
  );
}
