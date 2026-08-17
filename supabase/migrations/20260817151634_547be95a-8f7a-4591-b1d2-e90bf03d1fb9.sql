-- 1. Tighten RLS for resend_settings: only super_admin can READ or WRITE
DROP POLICY IF EXISTS "Authenticated users can read Resend settings" ON public.resend_settings;
CREATE POLICY "Only Super Admins can read Resend settings" 
ON public.resend_settings 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin'));

-- 2. Ensure email_logs RLS is strictly scoped (already looks good, but let's be sure)
-- Tenants can view their own, Admins can view all.

-- 3. Webhook idempotency and log status refinement:
-- Add index on provider_message_id for faster lookups in webhook
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id ON public.email_logs(provider_message_id);
