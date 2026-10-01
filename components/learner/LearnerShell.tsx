"use client";

import { GraduationCap, TrendingUp } from "lucide-react";
import WorkspaceShell, { type WorkspaceNavItem } from "./WorkspaceShell";

const NAV: WorkspaceNavItem[] = [
  { href: "/apprenant", label: "Mes formations", icon: GraduationCap, match: (p) => p === "/apprenant" || /^\/apprenant\/(?!progression)[^/]+\/?$/.test(p) },
  { href: "/apprenant/progression", label: "Ma progression", icon: TrendingUp, match: (p) => p.startsWith("/apprenant/progression") },
];

/** Cadre des pages apprenant (hors page leçon, qui a son propre menu). */
export default function LearnerShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell homeHref="/apprenant" nav={NAV}>
      {children}
    </WorkspaceShell>
  );
}
