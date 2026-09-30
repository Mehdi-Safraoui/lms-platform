-- Bucket public des images de leçon (bloc "image_text" : captures d'écran,
-- schémas), uploadées par le Formateur via POST /api/org/formations/[id]/media.
--
-- Public : l'image est lue directement par le navigateur de l'apprenant, via
-- une URL non devinable ({formation_id}/{uuid}.{ext}) mais sans contrôle
-- d'accès — choix validé pour du contenu de formation. Les uploads passent
-- uniquement par le client service_role (pas de policy INSERT nécessaire).
-- Limites alignées sur la route : 4 Mo, PNG / JPEG / WebP / GIF.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lesson-media', 'lesson-media', true, 4194304, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;
