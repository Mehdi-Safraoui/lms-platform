-- Brouillon de structure Module → Leçon proposé par l'IA (V2 — Carte 43-46),
-- éditable par le Formateur avant validation. Table séparée de formation_cadrage
-- (concept différent : un objet imbriqué édité librement, pas des réponses figées
-- de questionnaire) mais même relation 1:1 avec la formation.
--
-- `proposal` contient la structure courante (générée puis potentiellement modifiée
-- côté client : modules renommés/réordonnés/ajoutés/supprimés) — voir
-- lib/ai/structureProposal.ts pour la forme exacte (modules[].lessons[]).
-- `validated_at` : posé au clic sur "Valider la structure", moment où cette
-- structure est matérialisée en vraies lignes modules/lecons (contenu vide,
-- prêtes pour la génération leçon par leçon de la liste suivante).
CREATE TABLE public.formation_structure (
  formation_id uuid PRIMARY KEY REFERENCES public.formations(id) ON DELETE CASCADE,
  proposal jsonb NOT NULL,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.formation_structure TO service_role;

NOTIFY pgrst, 'reload schema';
