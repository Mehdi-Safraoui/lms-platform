-- Ajoute le support du contenu riche généré par IA (blocs : heading, paragraph,
-- callout, comparison, feature_grid, highlight, list — voir lib/ai/contentBlocks.ts).
-- Les leçons existantes ('markdown', 'video', 'quiz') ne sont pas affectées.

ALTER TABLE public.lecons
  ADD COLUMN content_blocks jsonb;

ALTER TABLE public.lecons
  DROP CONSTRAINT IF EXISTS lecons_content_type_check;

ALTER TABLE public.lecons
  ADD CONSTRAINT lecons_content_type_check
  CHECK (content_type IN ('markdown', 'video', 'quiz', 'rich'));

NOTIFY pgrst, 'reload schema';
