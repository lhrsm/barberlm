ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
