-- Fix : chunks et knowledge_sources n'avaient jamais reçu la permission DELETE
-- pour service_role (trouvé en testant le pipeline chunking -> embedding -> insertion :
-- la suppression d'une formation/knowledge_source laissait des chunks orphelins,
-- silencieusement, car service_role n'a pas de bypass RLS/GRANT automatique pour
-- les nouvelles tables — chaque droit doit être accordé explicitement).

GRANT DELETE ON public.chunks TO service_role;
GRANT DELETE ON public.knowledge_sources TO service_role;

NOTIFY pgrst, 'reload schema';