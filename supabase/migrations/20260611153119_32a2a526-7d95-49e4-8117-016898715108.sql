-- Função para recalcular saldos de clientes a partir do histórico de transações
CREATE OR REPLACE FUNCTION public.fn_recalculate_customer_balances(p_customer_id UUID)
RETURNS TABLE (new_credit_balance NUMERIC, new_cashback_balance NUMERIC) AS $$
DECLARE
    v_credit NUMERIC;
    v_cashback NUMERIC;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN type IN ('earned', 'credit_earned', 'granted', 'manual_added', 'credit') THEN amount ELSE -amount END), 0)
    INTO v_credit
    FROM public.credit_transactions WHERE customer_id = p_customer_id;

    SELECT COALESCE(SUM(CASE WHEN type IN ('earned', 'cashback_earned', 'granted', 'credit') THEN amount ELSE -amount END), 0)
    INTO v_cashback
    FROM public.cashback_transactions WHERE customer_id = p_customer_id;

    UPDATE public.customers
    SET credits = v_credit,
        cashback_balance = v_cashback,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN QUERY SELECT v_credit, v_cashback;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar o resumo financeiro da barbearia
CREATE OR REPLACE FUNCTION public.fn_get_financial_summary(p_tenant_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS JSONB AS $$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'servicos_vendidos', COALESCE(SUM(total_price), 0),
        'entrada_caixa', COALESCE(SUM(pix_amount + cash_amount + credit_card_amount + debit_card_amount), 0),
        'cashback_concedido', COALESCE(SUM(cashback_earned), 0),
        'cashback_utilizado', COALESCE(SUM(cashback_used), 0),
        'creditos_utilizados', COALESCE(SUM(credits_used), 0)
    ) INTO v_summary
    FROM public.appointments
    WHERE tenant_id = p_tenant_id 
      AND status = 'completed'
      AND completed_at::DATE BETWEEN p_start_date AND p_end_date;

    RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
