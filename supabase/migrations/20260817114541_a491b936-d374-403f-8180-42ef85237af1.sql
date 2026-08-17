DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identity_status') THEN
        CREATE TYPE public.identity_status AS ENUM ('legacy', 'pending', 'completed');
    END IF;
END $$;

-- profiles evolution
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS identity_status public.identity_status DEFAULT 'legacy';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

-- customers evolution
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS auth_migration_status public.identity_status DEFAULT 'legacy';

-- barbers evolution
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS auth_migration_status public.identity_status DEFAULT 'legacy';

-- tenant_memberships
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'barber',
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(tenant_id, user_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_memberships TO authenticated;
GRANT ALL ON public.tenant_memberships TO service_role;

-- RLS
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own memberships' AND tablename = 'tenant_memberships') THEN
        CREATE POLICY "Users can view their own memberships"
        ON public.tenant_memberships FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id OR auth.uid() = tenant_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage their tenant memberships' AND tablename = 'tenant_memberships') THEN
        CREATE POLICY "Admins can manage their tenant memberships"
        ON public.tenant_memberships FOR ALL
        TO authenticated
        USING (auth.uid() = tenant_id);
    END IF;
END $$;

-- Identity Context Function
CREATE OR REPLACE FUNCTION public.get_current_identity_context()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_id uuid := auth.uid();
    _profile record;
    _membership record;
    _result json;
BEGIN
    IF _user_id IS NULL THEN
        RETURN json_build_object('authenticated', false);
    END IF;

    -- Get profile
    SELECT * INTO _profile FROM public.profiles WHERE id = _user_id;

    -- Get active membership (simplified for single tenant for now)
    SELECT * INTO _membership FROM public.tenant_memberships WHERE user_id = _user_id LIMIT 1;

    _result := json_build_object(
        'authenticated', true,
        'user_id', _user_id,
        'profile', row_to_json(_profile),
        'tenant_id', COALESCE(_membership.tenant_id, CASE WHEN _profile.role = 'tenant_admin' THEN _profile.id ELSE _profile.tenant_id END),
        'role', COALESCE(_membership.role, _profile.role),
        'identity_status', _profile.identity_status
    );

    RETURN _result;
END;
$$;
