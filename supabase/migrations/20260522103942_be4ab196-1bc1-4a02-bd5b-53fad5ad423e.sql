-- Support Tickets enhancements
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachment_urls TEXT[];

-- Support Messages enhancements
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS attachment_urls TEXT[];

-- Tutorial Categories
CREATE TABLE IF NOT EXISTS public.tutorial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tutorials
CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.tutorial_categories(id),
    type TEXT NOT NULL CHECK (type IN ('video', 'pdf', 'link', 'document')),
    content_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Onboarding Settings (Global)
CREATE TABLE IF NOT EXISTS public.onboarding_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_url TEXT,
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default onboarding setting if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.onboarding_settings) THEN
        INSERT INTO public.onboarding_settings (video_url, message)
        VALUES ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Bem-vindo ao Barbex! Assista ao vídeo para começar.');
    END IF;
END $$;

-- User Onboarding Preferences
CREATE TABLE IF NOT EXISTS public.user_onboarding_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    show_onboarding BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutorial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for tutorial_categories
CREATE POLICY "Everyone can view tutorial categories" ON public.tutorial_categories FOR SELECT USING (true);
CREATE POLICY "Only super admins can manage tutorial categories" ON public.tutorial_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Policies for tutorials
CREATE POLICY "Everyone can view tutorials" ON public.tutorials FOR SELECT USING (true);
CREATE POLICY "Only super admins can manage tutorials" ON public.tutorials FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Policies for onboarding_settings
CREATE POLICY "Everyone can view onboarding settings" ON public.onboarding_settings FOR SELECT USING (true);
CREATE POLICY "Only super admins can manage onboarding settings" ON public.onboarding_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Policies for user_onboarding_preferences
CREATE POLICY "Users can view their own preferences" ON public.user_onboarding_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own preferences" ON public.user_onboarding_preferences FOR ALL USING (auth.uid() = user_id);

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('support-attachments', 'support-attachments', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('tutorial-assets', 'tutorial-assets', true) ON CONFLICT DO NOTHING;

-- Storage Policies for support-attachments
CREATE POLICY "Public Access to Support Attachments" ON storage.objects FOR SELECT USING (bucket_id = 'support-attachments');
CREATE POLICY "Users can upload support attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'support-attachments');

-- Storage Policies for tutorial-assets
CREATE POLICY "Public Access to Tutorial Assets" ON storage.objects FOR SELECT USING (bucket_id = 'tutorial-assets');
CREATE POLICY "Super Admins can manage tutorial assets" ON storage.objects FOR ALL USING (
    bucket_id = 'tutorial-assets' AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
