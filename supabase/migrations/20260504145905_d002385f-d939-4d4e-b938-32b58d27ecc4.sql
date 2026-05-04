ALTER TABLE public.profiles ADD COLUMN scheduling_mode TEXT DEFAULT 'automatic';
COMMENT ON COLUMN public.profiles.scheduling_mode IS 'Mode of scheduling: manual or automatic';