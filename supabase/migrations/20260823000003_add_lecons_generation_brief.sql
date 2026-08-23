-- Conserve la courte description générée pour chaque leçon lors de la
-- proposition de structure (lib/ai/structureProposal.ts) — sans cette colonne,
-- cette description était perdue à la matérialisation en vraies lignes lecons
-- (validate route), alors que la génération de contenu leçon par leçon en a
-- besoin pour savoir précisément ce que la leçon doit couvrir (pas juste son
-- titre). Nullable : sans objet pour les leçons créées manuellement.
ALTER TABLE public.lecons
  ADD COLUMN generation_brief text;

NOTIFY pgrst, 'reload schema';
