-- Stocke les réponses du skill d'accompagnement (interview de cadrage, V2 —
-- Carte 39-41) : une ligne par formation en cours de création par IA. Ces
-- réponses alimentent ensuite les prompts de proposition de structure et de
-- génération de contenu leçon par leçon (cartes suivantes, pas encore construites).
--
-- notions_a_inclure / notions_a_exclure en text[] plutôt qu'un blob texte : ce
-- sont les champs reformulés par Claude en liste propre côté API (voir
-- POST /api/org/formations/[id]/cadrage/step), plus directement exploitables
-- tels quels dans un prompt de génération qu'un texte libre à re-parser.
--
-- Pas de RLS à la création — même pattern que agent_messages/notifications :
-- toutes les routes réelles passent par le client service_role qui bypass la
-- RLS, celle-ci n'est jamais le mécanisme d'isolation réel (voir
-- lib/api/require-admin-tenant.ts pour la vérification explicite du tenant).
CREATE TABLE public.formation_cadrage (
  formation_id uuid PRIMARY KEY REFERENCES public.formations(id) ON DELETE CASCADE,
  objectif text,
  public_vise text,
  niveau text CHECK (niveau IN ('debutant', 'intermediaire', 'avance')),
  nb_modules_souhaite integer CHECK (nb_modules_souhaite BETWEEN 1 AND 20),
  duree_estimee text,
  notions_a_inclure text[],
  notions_a_exclure text[],
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.formation_cadrage TO service_role;

NOTIFY pgrst, 'reload schema';
