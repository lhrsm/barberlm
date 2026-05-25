-- Make customer_id mandatory in product_sales
ALTER TABLE public.product_sales ALTER COLUMN customer_id SET NOT NULL;

-- Add check constraint to ensure items is not empty
ALTER TABLE public.product_sales ADD CONSTRAINT check_items_not_empty CHECK (jsonb_array_length(items) > 0);

-- Add comments to explain column meanings
COMMENT ON COLUMN public.product_sales.user_id IS 'Identificador do salão (salon_id)';
COMMENT ON COLUMN public.product_sales.customer_id IS 'Identificador do cliente (obrigatório)';
