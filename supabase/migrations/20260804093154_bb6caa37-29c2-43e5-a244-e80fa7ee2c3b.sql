-- Create Academy Tables
CREATE TABLE public.academy_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    profile_target public.app_role NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    "order" INTEGER DEFAULT 0,
    duration TEXT,
    difficulty TEXT,
    level TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.academy_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID REFERENCES public.academy_paths(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.academy_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES public.academy_modules(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    video_url TEXT,
    checklist JSONB DEFAULT '[]'::jsonb,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE SET NULL,
    route_path TEXT,
    duration TEXT,
    "order" INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.academy_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    path_id UUID REFERENCES public.academy_paths(id) ON DELETE CASCADE NOT NULL,
    lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'started', -- 'started', 'completed'
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, lesson_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_paths TO authenticated;
GRANT ALL ON public.academy_paths TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_modules TO authenticated;
GRANT ALL ON public.academy_modules TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_lessons TO authenticated;
GRANT ALL ON public.academy_lessons TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;

-- RLS
ALTER TABLE public.academy_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;

-- Policies for academy_paths
CREATE POLICY "Public paths are viewable by all authenticated"
    ON public.academy_paths FOR SELECT
    TO authenticated
    USING (status = 'published' OR tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Policies for academy_modules
CREATE POLICY "Modules viewable by authenticated if path is viewable"
    ON public.academy_modules FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.academy_paths p
        WHERE p.id = academy_modules.path_id
        AND (p.status = 'published' OR p.tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
    ));

-- Policies for academy_lessons
CREATE POLICY "Lessons viewable by authenticated if path is viewable"
    ON public.academy_lessons FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.academy_modules m
        JOIN public.academy_paths p ON p.id = m.path_id
        WHERE m.id = academy_lessons.module_id
        AND (p.status = 'published' OR p.tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
    ));

-- Policies for academy_progress
CREATE POLICY "Users can manage their own progress"
    ON public.academy_progress FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_academy_paths_updated_at BEFORE UPDATE ON public.academy_paths FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_academy_lessons_updated_at BEFORE UPDATE ON public.academy_lessons FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_academy_progress_updated_at BEFORE UPDATE ON public.academy_progress FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
