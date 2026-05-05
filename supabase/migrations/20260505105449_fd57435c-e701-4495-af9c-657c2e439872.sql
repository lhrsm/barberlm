-- Update function to set search_path for security
ALTER FUNCTION public.handle_product_sale_status_change() SET search_path = public;