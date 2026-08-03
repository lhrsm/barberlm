CREATE TABLE public.marketing_audiences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    description text,
    is_dynamic boolean DEFAULT true,
    filters jsonb DEFAULT '[]'::jsonb,
    total_count integer DEFAULT 0,
    last_count_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_audiences TO authenticated;
GRANT ALL ON public.marketing_audiences TO service_role;

ALTER TABLE public.marketing_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their own audiences"
    ON public.marketing_audiences
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.uid());
