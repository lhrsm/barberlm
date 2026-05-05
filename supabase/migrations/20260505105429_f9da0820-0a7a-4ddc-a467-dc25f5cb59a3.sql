-- Create function to handle stock updates on sale status change
CREATE OR REPLACE FUNCTION public.handle_product_sale_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- Check if status has changed
    IF (OLD.status = NEW.status) THEN
        RETURN NEW;
    END IF;

    -- Scenario 1: Sale was completed but now cancelled or refunded (Return items to stock)
    IF (OLD.status = 'completed' AND (NEW.status = 'cancelled' OR NEW.status = 'refunded')) THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(OLD.items) AS x(product_id UUID, quantity INT)
        LOOP
            UPDATE public.products 
            SET stock_quantity = stock_quantity + v_item.quantity
            WHERE id = v_item.product_id;
        END LOOP;
    END IF;

    -- Scenario 2: Sale was cancelled or refunded but now completed (Remove items from stock)
    -- This handles cases where a user might accidentally cancel and then revert
    IF ((OLD.status = 'cancelled' OR OLD.status = 'refunded') AND NEW.status = 'completed') THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(product_id UUID, quantity INT)
        LOOP
            UPDATE public.products 
            SET stock_quantity = stock_quantity - v_item.quantity
            WHERE id = v_item.product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_product_sale_status_change ON public.product_sales;
CREATE TRIGGER tr_product_sale_status_change
AFTER UPDATE OF status ON public.product_sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_product_sale_status_change();