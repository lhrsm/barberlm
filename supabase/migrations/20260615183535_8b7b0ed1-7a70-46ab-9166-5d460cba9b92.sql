CREATE OR REPLACE FUNCTION public.fn_get_financial_summary(p_tenant_id uuid, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'servicos_vendidos', COALESCE(SUM(total_price), 0),
        'entrada_caixa', COALESCE(SUM(pix_amount + cash_amount + credit_card_amount + debit_card_amount), 0),
        'cashback_concedido', COALESCE(SUM(cashback_earned), 0),
        'cashback_utilizado', COALESCE(SUM(cashback_used), 0),
        'creditos_utilizados', COALESCE(SUM(credits_used), 0),
        'assinatura_coberta', COALESCE(SUM(subscription_covered_amount), 0),
        'assinatura_extra', COALESCE(SUM(extra_amount), 0),
        'atendimentos_assinatura', COALESCE(SUM(CASE WHEN subscription_id IS NOT NULL THEN 1 ELSE 0 END), 0)
    ) INTO v_summary
    FROM public.appointments
    WHERE tenant_id = p_tenant_id 
      AND status = 'completed'
      AND completed_at::DATE BETWEEN p_start_date AND p_end_date;

    RETURN v_summary;
END;
$function$;