-- Add financial tracking columns to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS original_total DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS credit_used DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pix_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS barbershop_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2) DEFAULT 0;

-- Update existing records to have at least original_total populated
UPDATE public.appointments 
SET original_total = total_price 
WHERE original_total IS NULL;

-- Ensure total_price reflects the original total for consistency with existing UI
-- while final_amount tracks the actual new revenue.
UPDATE public.appointments 
SET final_amount = total_price 
WHERE final_amount = 0 AND payment_status = 'paid';
