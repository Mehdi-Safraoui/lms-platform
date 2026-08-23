-- Historique de la conversation avec l'agent pédagogique (carte "Affichage des
-- messages avec historique", Semaine5) — sans cette table, le chat perdait
-- tout son contenu à chaque rechargement de page (state React en mémoire
-- uniquement, voir carte précédente).
CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- L'historique est lu par (user_id, formation_id), toujours trié par date.
CREATE INDEX agent_messages_user_formation_idx
  ON public.agent_messages(user_id, formation_id, created_at);

-- Même choix que notifications/user_enrollments : pas de RLS, l'app passe
-- toujours par le client service_role côté API (requireAuth() + vérification
-- explicite de l'inscription dans app/api/agent/[formationId]/route.ts).
GRANT SELECT, INSERT ON public.agent_messages TO service_role;

NOTIFY pgrst, 'reload schema';
