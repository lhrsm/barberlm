-- Add payments_test_mode column to system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS payments_test_mode BOOLEAN DEFAULT true;

-- Update the description in comments for better DB documentation
COMMENT ON COLUMN public.system_settings.payments_test_mode IS 'Flag to control if payments should use Stripe Sandbox (true) or Live (false) mode.';