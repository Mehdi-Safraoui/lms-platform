-- "Automatically expose new tables" est désactivé sur ce projet (choix volontaire) :
-- aucun rôle n'a de droits sur une nouvelle table par défaut, pas même service_role
-- (bypass RLS ne veut pas dire bypass des GRANT Postgres classiques).
-- On donne ici l'accès complet au service_role uniquement (usage serveur de confiance).
-- Les droits pour anon/authenticated seront accordés en même temps que les policies RLS.

grant usage on schema public to service_role;

grant all on public.tenants to service_role;
grant all on public.users to service_role;
grant all on public.formations to service_role;
grant all on public.modules to service_role;
grant all on public.lecons to service_role;
