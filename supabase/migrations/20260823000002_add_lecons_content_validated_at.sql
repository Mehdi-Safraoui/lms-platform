-- Distingue "contenu généré" (content_blocks non nul, ou une ligne quizzes pour
-- une leçon quiz) de "contenu validé par le Formateur" (carte "Bouton Valider
-- et passer à la leçon suivante", V2 — human-in-the-loop). Sans cette colonne,
-- une régénération laisserait du contenu présent sans qu'il ait été
-- explicitement revalidé, et la carte "Publication" (une fois toutes les
-- leçons validées) ne pourrait pas distinguer les deux états.
ALTER TABLE public.lecons
  ADD COLUMN content_validated_at timestamptz;

NOTIFY pgrst, 'reload schema';
