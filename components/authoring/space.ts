/**
 * Espace dans lequel le flow de création de formation par IA est affiché :
 * "org" pour un admin_tenant (formation privée de son tenant), "admin" pour le
 * super_admin (formation du catalogue global Ahead). Les étapes et les routes
 * API (/api/org/formations/...) sont les mêmes — seuls les liens de
 * navigation et le contrôle d'accès des pages diffèrent.
 */
export type AuthoringSpace = "org" | "admin";

/** Préfixe des pages du flow : `${basePath}/${formationId}/sources`, etc. */
export const AUTHORING_BASE_PATH: Record<AuthoringSpace, string> = {
  org: "/org/formations",
  admin: "/admin/catalog",
};

/** Lien "Catalogue" en tête des premières étapes. */
export const AUTHORING_CATALOGUE_PATH: Record<AuthoringSpace, string> = {
  org: "/org/catalogue",
  admin: "/admin/catalog",
};
