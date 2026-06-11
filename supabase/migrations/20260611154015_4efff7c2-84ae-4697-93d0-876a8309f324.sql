-- Função unificada de recalcular fidelidade (Apenas agendamentos CONCLUÍDOS)
CREATE OR REPLACE FUNCTION public.fn_recalculate_customer_loyalty(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_points INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_points
    FROM public.appointments
    WHERE customer_id = p_customer_id AND status = 'completed';

    UPDATE public.customers
    SET loyalty_points = v_points,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN v_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
