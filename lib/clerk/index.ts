/**
 * Helpers Clerk : extraction du tenant (org), du rôle, et des metadata.
 *
 * Clerk Organizations = Tenants.
 *
 * Les rôles personnalisés (admin_tenant, tuteur, apprenant) ne sont pas encore configurés
 * côté Clerk : on mappe pour l'instant les rôles génériques Clerk (org:admin / org:member)
 * vers notre modèle de rôles. À remplacer par les rôles personnalisés Clerk plus tard.
 */
import type { Role } from "@/types/database";

export function mapClerkOrgRoleToAppRole(clerkRole: string): Role {
  return clerkRole === "org:admin" ? "admin_tenant" : "apprenant";
}
