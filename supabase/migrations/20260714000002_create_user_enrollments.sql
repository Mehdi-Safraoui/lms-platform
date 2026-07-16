CREATE TABLE public.user_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, formation_id)
);

CREATE INDEX user_enrollments_user_id_idx ON public.user_enrollments(user_id);
CREATE INDEX user_enrollments_formation_id_idx ON public.user_enrollments(formation_id);
CREATE INDEX user_enrollments_tenant_id_idx ON public.user_enrollments(tenant_id);

GRANT SELECT, INSERT, DELETE ON public.user_enrollments TO service_role;
NOTIFY pgrst, 'reload schema';
