CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_id_idx ON public.notifications(recipient_user_id);
CREATE INDEX notifications_tenant_id_idx ON public.notifications(tenant_id);
CREATE INDEX notifications_sender_id_idx ON public.notifications(sender_user_id);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO service_role;
NOTIFY pgrst, 'reload schema';
