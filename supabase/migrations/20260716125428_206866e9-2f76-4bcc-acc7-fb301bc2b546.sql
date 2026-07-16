
ALTER TABLE public.notification_recipients ADD COLUMN IF NOT EXISTS barber_id uuid REFERENCES public.barbers(id) ON DELETE CASCADE;
ALTER TABLE public.notification_recipients DROP CONSTRAINT IF EXISTS notification_recipients_tenant_id_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_tenant_phone_barber_key
  ON public.notification_recipients (tenant_id, phone, COALESCE(barber_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_notification_recipients_barber ON public.notification_recipients(barber_id) WHERE barber_id IS NOT NULL;
