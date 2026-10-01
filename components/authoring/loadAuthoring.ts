import { redirect, notFound } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { canAuthorFormationByAi } from "@/lib/subscription";
import type { AuthoringSpace } from "./space";

export interface AuthoringUser {
  /** Tenant propriétaire des formations construites dans cet espace (null = catalogue global). */
  tenantId: string | null;
  /** Abonnement suffisant pour l'IA — toujours vrai pour le super_admin. */
  eligible: boolean;
}

export interface AuthoringFormation extends AuthoringUser {
  formation: { id: string; title: string; tenant_id: string | null; is_published: boolean };
}

/**
 * Contrôle d'accès des pages du flow, même règle que requireFormationAuthor
 * côté API : admin_tenant dans l'espace "org", super_admin dans l'espace
 * "admin" (le proxy filtre déjà /org et /admin par rôle, ceci est la
 * vérification explicite côté page).
 */
export async function loadAuthoringUser(space: AuthoringSpace): Promise<AuthoringUser> {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/sign-in");

  if (space === "admin") {
    if (currentUser?.role !== "super_admin") redirect("/");
    return { tenantId: null, eligible: true };
  }

  if (!currentUser?.tenant_id || currentUser.role !== "admin_tenant") redirect("/org");
  return { tenantId: currentUser.tenant_id, eligible: await canAuthorFormationByAi(currentUser.tenant_id) };
}

/**
 * Comme loadAuthoringUser, plus la formation de l'URL — 404 si elle
 * n'appartient pas à cet espace (formation d'un autre tenant, ou formation
 * privée d'un tenant vue depuis l'espace admin, et inversement).
 */
export async function loadAuthoringFormation(space: AuthoringSpace, formationId: string): Promise<AuthoringFormation> {
  const [user, { data: formation }] = await Promise.all([
    loadAuthoringUser(space),
    createServiceRoleSupabaseClient()
      .from("formations")
      .select("id, title, tenant_id, is_published")
      .eq("id", formationId)
      .single(),
  ]);

  if (!formation || formation.tenant_id !== user.tenantId) notFound();

  return { ...user, formation };
}
