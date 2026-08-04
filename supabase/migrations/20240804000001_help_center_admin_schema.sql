-- Extension tables for Help Center and Academy Admin

-- 1. Article Versions for history and rollback
CREATE TABLE IF NOT EXISTS public.article_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    author_id UUID REFERENCES auth.users(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Content Workflow Logs
CREATE TABLE IF NOT EXISTS public.content_workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL, -- 'tutorial' or 'lesson'
    content_id UUID NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Content Analytics (Aggregated)
CREATE TABLE IF NOT EXISTS public.content_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL,
    content_id UUID NOT NULL,
    views_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    avg_reading_time_seconds INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    UNIQUE(content_type, content_id)
);

-- Add missing columns to tutorials if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutorials' AND column_name = 'status') THEN
        ALTER TABLE public.tutorials ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutorials' AND column_name = 'version') THEN
        ALTER TABLE public.tutorials ADD COLUMN version INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutorials' AND column_name = 'author_id') THEN
        ALTER TABLE public.tutorials ADD COLUMN author_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutorials' AND column_name = 'metadata') THEN
        ALTER TABLE public.tutorials ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add missing columns to academy_lessons
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_lessons' AND column_name = 'status') THEN
        ALTER TABLE public.academy_lessons ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_lessons' AND column_name = 'metadata') THEN
        ALTER TABLE public.academy_lessons ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_versions TO authenticated;
GRANT ALL ON public.article_versions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_workflow_logs TO authenticated;
GRANT ALL ON public.content_workflow_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_analytics TO authenticated;
GRANT ALL ON public.content_analytics TO service_role;

-- RLS
ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_analytics ENABLE ROW LEVEL SECURITY;

-- Policies (Restricted to Admins)
CREATE POLICY "Admins can manage article versions"
ON public.article_versions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view and create workflow logs"
ON public.content_workflow_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage content analytics"
ON public.content_analytics
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Public policy for viewing analytics (if needed by frontend)
CREATE POLICY "Everyone can view analytics"
ON public.content_analytics
FOR SELECT
TO authenticated
USING (true);

