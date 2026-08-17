-- Security Activity Logs
CREATE TABLE IF NOT EXISTS public.security_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_type text NOT NULL, -- login_success, password_changed, email_change_requested, etc.
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.security_activity_logs TO authenticated;
GRANT ALL ON public.security_activity_logs TO service_role;
ALTER TABLE public.security_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security logs"
    ON public.security_activity_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
