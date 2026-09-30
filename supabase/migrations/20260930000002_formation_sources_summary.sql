-- Fiche de synthèse des documents source d'une formation, générée une fois par
-- l'IA à partir du texte COMPLET des documents, puis réutilisée par le bouton
-- "Décider pour moi" du cadrage (jusqu'à 7 appels par cadrage) — au lieu de
-- renvoyer tout le document au modèle à chaque champ, ou de n'en lire que le
-- début.
--
-- source_ids : knowledge_sources (statut "terminee") à partir desquels la
-- synthèse a été produite. Si la liste change (document ajouté ou retiré), la
-- synthèse est considérée périmée et régénérée — voir lib/sourcesSummary.ts.
--
-- Pas de RLS, même pattern que formation_cadrage / formation_structure : seules
-- les routes serveur (client service_role) y accèdent, après
-- requireFormationAuthor + assertOwnFormation.
CREATE TABLE IF NOT EXISTS public.formation_sources_summary (
  formation_id uuid PRIMARY KEY REFERENCES public.formations(id) ON DELETE CASCADE,
  summary text NOT NULL,
  source_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_sources_summary TO service_role;

NOTIFY pgrst, 'reload schema';
