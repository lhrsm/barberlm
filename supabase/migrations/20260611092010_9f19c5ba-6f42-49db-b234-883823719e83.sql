CREATE OR REPLACE FUNCTION public.recalculate_customer_stats(p_customer_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_cashback NUMERIC(10,2) := 0;
    v_total_credits NUMERIC(10,2) := 0;
    v_total_loyalty INTEGER := 0;
BEGIN
    -- Somar cashback (earned/granted/credit - used/debit/reversed)
    SELECT COALESCE(SUM(
        CASE 
            WHEN type IN ('earned', 'cashback_earned', 'granted', 'credit') THEN amount 
            WHEN type IN ('used', 'debit', 'reversed', 'cashback_reversed') THEN -amount 
            ELSE 0 
        END
    ), 0)
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id
    INTO v_total_cashback;

    -- Somar créditos
    SELECT COALESCE(SUM(
        CASE 
            WHEN type IN ('earned', 'credit_earned', 'granted', 'manual_added', 'credit') THEN amount 
            WHEN type IN ('used', 'debit', 'reversed', 'credit_reversed', 'manual_removed') THEN -amount 
            ELSE 0 
        END
    ), 0)
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id
    INTO v_total_credits;

    -- Contar agendamentos concluídos para fidelidade (limitando ao threshold se necessário, ou mantendo total)
    -- Se o sistema usa pontos que "zeram" a cada 10, essa lógica de COUNT(*) simples pode ser diferente.
    -- No entanto, a maioria das barbearias prefere o saldo atual.
    -- Vamos pegar o valor atual e apenas garantir que não seja nulo, 
    -- ou manter o count se for essa a regra de negócio.
    -- Pela função handle_appointment_completion, ele incrementa +1 e zera ao chegar em 10.
    -- Então COUNT(*) não é o ideal para o saldo ATUAL de pontos se eles resetam.
    
    -- Se quisermos apenas o saldo atual de pontos, melhor não sobrescrever se não soubermos o ciclo.
    -- Mas o usuário quer corrigir a duplicidade.
    
    -- Vou manter a atualização de cashback e créditos que é o foco principal agora.
    
    UPDATE public.customers
    SET 
        cashback_balance = GREATEST(0, v_total_cashback),
        credits = GREATEST(0, v_total_credits),
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object(
        'success', true,
        'cashback_balance', v_total_cashback,
        'credits', v_total_credits
    );
END;
$function$;
