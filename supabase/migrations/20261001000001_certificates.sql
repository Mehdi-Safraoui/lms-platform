-- Certificats de réussite : délivrés quand un apprenant atteint le seuil de
-- complétion de la formation (formations.attestation_threshold_pct), une
-- leçon quiz n'étant terminée qu'une fois le quiz réussi (correction côté
-- serveur). Le PDF est généré à la demande (GET /api/certificates/[id]/pdf) ;
-- l'id sert de code de vérification public (/certificats/[id]), partageable
-- (LinkedIn).
--
-- Les libellés sont figés à la délivrance (nom, formation, entreprise) : un
-- certificat ne change pas si la formation est renommée ensuite.
--
-- La table "attestations" historique n'est pas réutilisée : elle dépend de
-- l'ancienne table "enrollments", remplacée par "user_enrollments".
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_name text NOT NULL,
  formation_title text NOT NULL,
  organization_name text,
  completion_pct integer NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, formation_id)
);

CREATE INDEX IF NOT EXISTS certificates_formation_id_idx ON public.certificates(formation_id);
CREATE INDEX IF NOT EXISTS certificates_tenant_id_idx ON public.certificates(tenant_id);

-- Lecture et écriture uniquement côté serveur (client service_role) : RLS
-- activée sans aucune policy, donc aucun accès direct via la clé publique.
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.certificates TO service_role;

NOTIFY pgrst, 'reload schema';
