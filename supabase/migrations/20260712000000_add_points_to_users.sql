-- Gamification : total de points accumulés par l'utilisateur
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_points integer NOT NULL DEFAULT 0;
