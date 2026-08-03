CREATE TABLE public.operational_insights_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rule_key TEXT NOT NULL,
    entity_id TEXT,
    status TEXT NOT NULL, -- 'resolved', 'dismissed', 'snoozed'
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_insights_interactions TO authenticated;
GRANT ALL ON public.operational_insights_interactions TO service_role;

ALTER TABLE public.operational_insights_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access" ON public.operational_insights_interactions
FOR ALL TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
