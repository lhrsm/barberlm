-- Update decrement_product_stock to handle quantity
CREATE OR REPLACE FUNCTION public.decrement_product_stock(prod_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - amount
  WHERE id = prod_id;
END;
$$ LANGUAGE plpgsql;

-- Ensure RLS for deletion
-- (Assuming users can only delete their own barbers)
CREATE POLICY "Users can delete their own barbers" 
ON public.barbers 
FOR DELETE 
USING (auth.uid() = user_id);
