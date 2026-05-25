-- Revert mandatory customer_id to avoid breaking existing admin dashboard features
ALTER TABLE public.product_sales ALTER COLUMN customer_id DROP NOT NULL;
