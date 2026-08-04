-- Changelog and Updates System

-- 1. Updates / Changelog entries
CREATE TABLE IF NOT EXISTS public.changelog_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    image_url TEXT,
    video_url TEXT,
    type TEXT NOT NULL DEFAULT 'feature', -- 'feature', 'improvement', 'fix', 'security', 'integration', 'beta', 'breaking', 'deprecation', 'maintenance'
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'archived'
    version_tag TEXT, -- e.g. '1.1'
    target_profiles TEXT[], -- array of roles: ['admin', 'manager', 'professional', etc.]
    target_tenants UUID[], -- selective tenants
    is_beta BOOLEAN DEFAULT false,
    requires_action BOOLEAN DEFAULT false,
    action_label TEXT,
    action_url TEXT,
    action_deadline TIMESTAMPTZ,
    related_articles UUID[], -- References to tutorial IDs
    metadata JSONB DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    author_id UUID REFERENCES auth.users(id)
);

-- 2. User reading/interaction status
CREATE TABLE IF NOT EXISTS public.changelog_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.changelog_entries(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID,
    status TEXT DEFAULT 'viewed', -- 'viewed', 'read', 'dismissed', 'action_completed'
    interacted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(entry_id, user_id)
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.changelog_entries TO authenticated;
GRANT ALL ON public.changelog_entries TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.changelog_interactions TO authenticated;
GRANT ALL ON public.changelog_interactions TO service_role;

-- RLS
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_interactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public published entries are visible to all authenticated"
ON public.changelog_entries
FOR SELECT
TO authenticated
USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage changelog entries"
ON public.changelog_entries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can manage their own interactions"
ON public.changelog_interactions
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

