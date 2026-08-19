
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
