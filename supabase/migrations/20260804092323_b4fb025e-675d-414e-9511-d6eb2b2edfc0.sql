
-- Add unique constraint to name if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutorial_categories_name_key') THEN
        ALTER TABLE public.tutorial_categories ADD CONSTRAINT tutorial_categories_name_key UNIQUE (name);
    END IF;
END $$;

-- Add new columns if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tutorials' AND column_name='slug') THEN
        ALTER TABLE public.tutorials ADD COLUMN slug text UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tutorials' AND column_name='profile_target') THEN
        ALTER TABLE public.tutorials ADD COLUMN profile_target text[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tutorials' AND column_name='module_key') THEN
        ALTER TABLE public.tutorials ADD COLUMN module_key text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tutorials' AND column_name='status') THEN
        ALTER TABLE public.tutorials ADD COLUMN status text DEFAULT 'published';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tutorials' AND column_name='related_route') THEN
        ALTER TABLE public.tutorials ADD COLUMN related_route text;
    END IF;
END $$;

-- Update tutorial categories
INSERT INTO public.tutorial_categories (name, icon, "order")
VALUES 
    ('Operação Diária', 'calendar', 2),
    ('Clientes e Relacionamento', 'users', 3),
    ('Equipe', 'briefcase', 4),
    ('Marketing e Comunicação', 'megaphone', 8),
    ('Indicadores e Inteligência', 'bar-chart', 9),
    ('Integrações', 'plug', 10),
    ('Segurança e Privacidade', 'shield', 11),
    ('Super Admin', 'user-cog', 12),
    ('Solução de Problemas', 'help-circle', 13),
    ('Novidades', 'sparkles', 14)
ON CONFLICT (name) DO UPDATE SET "order" = EXCLUDED."order", icon = EXCLUDED.icon;

UPDATE public.tutorial_categories SET "order" = 1 WHERE name = 'Primeiros passos';
UPDATE public.tutorial_categories SET "order" = 5 WHERE name = 'Financeiro';
UPDATE public.tutorial_categories SET "order" = 6 WHERE name = 'Produtos';
