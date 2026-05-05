-- Create enum for sale status if not exists
DO $$ BEGIN
    CREATE TYPE product_sale_status AS ENUM ('completed', 'cancelled', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create product_sales table
CREATE TABLE IF NOT EXISTS public.product_sales (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    customer_id UUID REFERENCES public.customers(id),
    total_amount DECIMAL(10,2) NOT NULL,
    status product_sale_status NOT NULL DEFAULT 'completed',
    items JSONB NOT NULL, -- Array of {product_id, name, price, quantity}
    pix_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own product sales" 
ON public.product_sales FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product sales" 
ON public.product_sales FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own product sales" 
ON public.product_sales FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to handle updated_at
CREATE TRIGGER update_product_sales_updated_at
BEFORE UPDATE ON public.product_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to process a sale and update stock
CREATE OR REPLACE FUNCTION public.process_product_sale(
    p_user_id UUID,
    p_customer_id UUID,
    p_total_amount DECIMAL,
    p_items JSONB,
    p_pix_key TEXT
) RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
BEGIN
    -- 1. Insert the sale record
    INSERT INTO public.product_sales (user_id, customer_id, total_amount, items, pix_key, status)
    VALUES (p_user_id, p_customer_id, p_total_amount, p_items, p_pix_key, 'completed')
    RETURNING id INTO v_sale_id;

    -- 2. Update stock for each item
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
    LOOP
        UPDATE public.products 
        SET stock_quantity = stock_quantity - v_item.quantity
        WHERE id = v_item.product_id AND user_id = p_user_id;
    END LOOP;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
