ALTER TABLE public.formations
  ADD COLUMN estimated_duration_minutes integer,
  ADD COLUMN attestation_threshold_pct integer NOT NULL DEFAULT 80;

NOTIFY pgrst, 'reload schema';
