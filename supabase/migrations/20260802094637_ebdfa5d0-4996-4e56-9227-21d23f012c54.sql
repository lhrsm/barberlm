ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_before_after jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_partners jsonb NOT NULL DEFAULT '[]'::jsonb;