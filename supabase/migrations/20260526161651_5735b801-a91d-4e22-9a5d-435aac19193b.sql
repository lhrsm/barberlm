-- Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fixed', 'percentage')),
    value NUMERIC NOT NULL,
    minimum_amount NUMERIC DEFAULT 0,
    max_discount NUMERIC,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tenant_id, code)
);

-- Update appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenants can manage their own coupons" 
ON public.coupons 
FOR ALL 
TO authenticated 
USING (auth.uid() = tenant_id);

CREATE POLICY "Anyone can view coupons by code" 
ON public.coupons 
FOR SELECT 
TO anon, authenticated 
USING (active = true);

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'coupons'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;
    END IF;
END $$;
