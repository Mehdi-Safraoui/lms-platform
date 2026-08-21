-- Vidéo(s) d'accompagnement d'une formation, choisies par un humain après génération
-- (lien collé directement, ou choisi parmi des suggestions réelles de l'API YouTube —
-- jamais une URL inventée par le LLM). Tableau (pas un objet unique) pour rester
-- ouvert à plusieurs vidéos plus tard, même si le flow actuel n'en gère qu'une.
ALTER TABLE public.formations
  ADD COLUMN videos jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
