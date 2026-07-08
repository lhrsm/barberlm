
-- 1) Table
CREATE TABLE public.notification_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'other',
  phone TEXT,
  email TEXT,
  receive_whatsapp BOOLEAN NOT NULL DEFAULT true,
  receive_email BOOLEAN NOT NULL DEFAULT false,
  receive_panel BOOLEAN NOT NULL DEFAULT true,
  notify_new_appointment BOOLEAN NOT NULL DEFAULT true,
  notify_rescheduled_appointment BOOLEAN NOT NULL DEFAULT true,
  notify_cancelled_appointment BOOLEAN NOT NULL DEFAULT true,
  notify_completed_appointment BOOLEAN NOT NULL DEFAULT false,
  notify_new_subscription BOOLEAN NOT NULL DEFAULT true,
  notify_subscription_cancelled BOOLEAN NOT NULL DEFAULT true,
  notify_payment_received BOOLEAN NOT NULL DEFAULT true,
  notify_payment_failed BOOLEAN NOT NULL DEFAULT true,
  notify_review_received BOOLEAN NOT NULL DEFAULT false,
  notify_bad_review BOOLEAN NOT NULL DEFAULT true,
  notify_support_ticket BOOLEAN NOT NULL DEFAULT false,
  notify_automation_failure BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX idx_notification_recipients_tenant ON public.notification_recipients(tenant_id) WHERE is_active;

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_recipients TO authenticated;
GRANT ALL ON public.notification_recipients TO service_role;

-- 3) RLS
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own recipients"
ON public.notification_recipients
FOR ALL
TO authenticated
USING (tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- 4) updated_at trigger (reuse project function)
CREATE TRIGGER update_notification_recipients_updated_at
BEFORE UPDATE ON public.notification_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Profiles flag: allow internal notifications on the business phone
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allow_notifications_on_business_phone BOOLEAN NOT NULL DEFAULT false;
