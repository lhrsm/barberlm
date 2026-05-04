CREATE OR REPLACE FUNCTION decrement_product_stock(prod_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET stock_quantity = stock_quantity - amount
    WHERE id = prod_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
