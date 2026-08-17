-- 1. Create Invitations table
CREATE TABLE public.user_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    email text NOT NULL,
    phone text,
    role public.app_role NOT NULL,
    professional_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
    token_hash text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at timestamptz NOT NULL,
    invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE ON public.user_invitations TO authenticated;
GRANT ALL ON public.user_invitations TO service_role;

-- 3. RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations for their tenant"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
) OR tenant_id = auth.uid());

CREATE POLICY "Users can create invitations for their tenant"
ON public.user_invitations
FOR INSERT
TO authenticated
WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
) OR tenant_id = auth.uid());

CREATE POLICY "Users can update invitations for their tenant"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
) OR tenant_id = auth.uid());

-- 4. Audit Log for security
CREATE TABLE public.team_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    actor_id uuid REFERENCES auth.users(id),
    event_type text NOT NULL,
    target_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.team_audit_logs TO authenticated;
GRANT ALL ON public.team_audit_logs TO service_role;

ALTER TABLE public.team_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their tenant"
ON public.team_audit_logs
FOR SELECT
TO authenticated
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
) OR tenant_id = auth.uid());
