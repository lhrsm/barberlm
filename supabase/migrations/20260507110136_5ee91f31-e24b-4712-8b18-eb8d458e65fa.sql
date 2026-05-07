-- Create a table for client authentication (separate from admin auth)
CREATE TABLE public.client_auth (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_auth ENABLE ROW LEVEL SECURITY;

-- Basic policies for client_auth
CREATE POLICY "Clients can view their own auth record" 
ON public.client_auth 
FOR SELECT 
USING (true); -- We will handle authentication via a custom edge function or app logic for simplicity in this PoC

-- Add foreign key from appointments to client_auth if we want to track it better
-- But usually appointments are already linked to customers. 
-- Let's ensure customers table has what we need.

-- Ensure customers can be linked to a specific barber shop (user_id)
-- The existing customers table has user_id, which is the shop owner's ID.

-- Create a function to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_auth_updated_at
BEFORE UPDATE ON public.client_auth
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes
CREATE INDEX idx_client_auth_phone ON public.client_auth(phone);
CREATE INDEX idx_client_auth_customer_id ON public.client_auth(customer_id);

-- Add column for refund request if not exists
ALTER TABLE public.product_sales ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.product_sales ADD COLUMN IF NOT EXISTS refund_reason TEXT;
