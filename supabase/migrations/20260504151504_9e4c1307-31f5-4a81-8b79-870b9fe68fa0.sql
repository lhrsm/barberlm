-- Add new columns to barbers table
ALTER TABLE public.barbers 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Proprietário',
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0;

-- Update existing records if necessary (optional)
UPDATE public.barbers SET category = 'Proprietário' WHERE category IS NULL;
UPDATE public.barbers SET commission_rate = 50 WHERE category = 'Freelancer' AND commission_rate = 0;
