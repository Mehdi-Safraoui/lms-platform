-- Logo d'entreprise uploadé par l'admin_tenant via l'écran Clerk de création
-- d'Organization (juste après le sign-up). Déjà stocké côté Clerk (org.image_url +
-- org.has_image) mais jamais synchronisé vers Supabase jusqu'ici, donc invisible
-- dans l'app malgré l'upload réel. Synchronisé par le webhook Clerk
-- (organization.created/updated) — voir app/api/webhooks/clerk/route.ts.
ALTER TABLE public.tenants
  ADD COLUMN logo_url text;

NOTIFY pgrst, 'reload schema';
