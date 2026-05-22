ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS responsible_name TEXT,
ADD COLUMN IF NOT EXISTS barbers_range TEXT,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE;

-- Also ensure trial_end defaults to 15 days from now for new Pro users
-- but we'll handle this in the application logic during signup.
