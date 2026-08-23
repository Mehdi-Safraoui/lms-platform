-- Sans ça, les citations de leçon source ("Cette information vient de la
-- leçon : X") ne s'afficheraient que pour les réponses reçues pendant la
-- session en cours — perdues au rechargement de la page, puisque l'historique
-- (carte "Affichage des messages avec historique") ne relit que role/content.
ALTER TABLE public.agent_messages
  ADD COLUMN sources jsonb;

NOTIFY pgrst, 'reload schema';
