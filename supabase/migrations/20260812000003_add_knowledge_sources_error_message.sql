-- Permet de diagnostiquer un échec d'ingestion (ingestion_status = 'erreur') sans
-- avoir à fouiller les logs serveur.
ALTER TABLE public.knowledge_sources
  ADD COLUMN error_message text;

NOTIFY pgrst, 'reload schema';
