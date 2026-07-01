
ALTER TABLE public.tutorials
  ADD COLUMN IF NOT EXISTS long_description text,
  ADD COLUMN IF NOT EXISTS level text DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS estimated_time text DEFAULT '3 min',
  ADD COLUMN IF NOT EXISTS icon text;

ALTER TABLE public.tutorials DROP CONSTRAINT IF EXISTS tutorials_level_check;
ALTER TABLE public.tutorials ADD CONSTRAINT tutorials_level_check
  CHECK (level IN ('basico','intermediario','avancado'));

-- Allow content_url to be optional (some tutorials are only text)
ALTER TABLE public.tutorials ALTER COLUMN content_url DROP NOT NULL;
