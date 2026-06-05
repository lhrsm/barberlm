-- Create financial_adjustment_logs table
CREATE TABLE IF NOT EXISTS public.financial_adjustment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.barbershops(id),
    transaction_id UUID REFERENCES public.transactions(id),
    appointment_id UUID REFERENCES public.appointments(id),
    old_values JSONB,
    new_values JSONB,
    reason TEXT NOT NULL,
    adjusted_by UUID REFERENCES auth.users(id),
    adjusted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for financial_adjustment_logs
ALTER TABLE public.financial_adjustment_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT ON public.financial_adjustment_logs TO authenticated;
GRANT ALL ON public.financial_adjustment_logs TO service_role;

-- Policies for financial_adjustment_logs
CREATE POLICY "Users can view their own tenant logs" ON public.financial_adjustment_logs
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert their own tenant logs" ON public.financial_adjustment_logs
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

-- Add columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS pix_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_card_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS debit_card_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_adjustment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS adjusted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
