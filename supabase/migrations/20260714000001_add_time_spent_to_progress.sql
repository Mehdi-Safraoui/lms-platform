ALTER TABLE public.progress ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0;

GRANT UPDATE ON public.progress TO service_role;
NOTIFY pgrst, 'reload schema';
