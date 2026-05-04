-- Add plan column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

-- Ensure all current profiles have the free plan
UPDATE public.profiles SET plan = 'free' WHERE plan IS NULL;
