CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX user_badges_user_id_idx ON public.user_badges(user_id);

GRANT SELECT, INSERT ON public.user_badges TO service_role;
NOTIFY pgrst, 'reload schema';
