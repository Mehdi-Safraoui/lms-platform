-- Grant service_role write access on tables created in 20260701000002_new_tables.sql
-- These tables were not covered by the initial service_role grant migration.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_results    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attestations    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medias          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions   TO service_role;
