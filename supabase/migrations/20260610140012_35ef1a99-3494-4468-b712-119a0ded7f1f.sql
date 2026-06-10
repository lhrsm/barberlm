-- 1. Garantir que não existam duplicatas antes de criar a restrição
-- Se houver duplicatas por erro de teste anterior, mantemos apenas a mais antiga
DELETE FROM public.cashback_transactions a
USING public.cashback_transactions b
WHERE a.id > b.id 
  AND a.appointment_id = b.appointment_id 
  AND a.appointment_id IS NOT NULL;

-- 2. Adicionar restrição de unicidade para impedir duplicidade no nível do banco de dados
ALTER TABLE public.cashback_transactions 
DROP CONSTRAINT IF EXISTS unique_cashback_per_appointment;

ALTER TABLE public.cashback_transactions 
ADD CONSTRAINT unique_cashback_per_appointment UNIQUE (appointment_id);

-- 3. Atualizar a função complete_appointment para ser mais resiliente
CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text, p_changed_by_id uuid, p_source text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    v_cashback_base_amount NUMERIC(10,2);
    v_payment_status TEXT;
    v_payment_method TEXT;
    v_trans_id UUID;
    v_description TEXT;
    v_cashback_earned NUMERIC(10,2) := 0;
    v_existing_cashback BOOLEAN;
    v_existing_trans BOOLEAN;
BEGIN
    -- 1. Buscar agendamento e validar
    SELECT a.*, c.name as customer_name, s.name as service_name 
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já concluído');
    END IF;

    -- 2. Buscar configurações do tenant (cashback)
    SELECT cashback_enabled, cashback_percentage, cashback_minimum_amount
    FROM public.profiles
    WHERE id = v_appt.tenant_id INTO v_tenant;

    -- 3. Extração de valores do metadata ou do agendamento
    v_total_price := COALESCE(v_appt.total_price, 0);
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    
    -- Valores recebidos em dinheiro novo
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE(
        (p_metadata->>'credit_card_amount')::numeric, 
        (p_metadata->>'debit_card_amount')::numeric, 
        (p_metadata->>'card_amount')::numeric, 
        v_appt.credit_card_amount, 
        v_appt.debit_card_amount, 0
    );
    
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Normalização: v_final_amount é o que entrou de dinheiro novo
    IF (v_pix_amount = 0 AND v_cash_amount = 0 AND v_card_amount = 0 AND v_payment_method != 'mixed') THEN
        v_final_amount := v_total_price - v_credit_used - v_cashback_used;
        IF (v_payment_method = 'pix') THEN v_pix_amount := v_final_amount;
        ELSIF (v_payment_method = 'cash') THEN v_cash_amount := v_final_amount;
        END IF;
    ELSE
        v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    END IF;

    -- A base para cashback é apenas o dinheiro novo
    v_cashback_base_amount := v_final_amount;
    
    -- 4. Registrar transação financeira de entrada (se não existir)
    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id AND type = 'income') INTO v_existing_trans;

    IF v_final_amount > 0 AND NOT v_existing_trans THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');
        
        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category, 
            amount, pix_amount, cash_amount, credit_card_amount, 
            credits_amount, cashback_amount, payment_method, 
            description, date, payment_breakdown
        ) VALUES (
            v_appt.tenant_id, v_appt.tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
            v_final_amount, v_pix_amount, v_cash_amount, v_card_amount,
            v_credit_used, v_cashback_used, v_payment_method,
            v_description, CURRENT_DATE, 
            jsonb_build_object(
                'pix', v_pix_amount, 'cash', v_cash_amount, 
                'card', v_card_amount, 'credits', v_credit_used, 
                'cashback', v_cashback_used
            )
        );
    END IF;

    -- 5. Lógica de Cashback (Geração)
    SELECT EXISTS (SELECT 1 FROM public.cashback_transactions WHERE appointment_id = p_appointment_id AND type = 'credit') INTO v_existing_cashback;

    IF v_tenant.cashback_enabled AND v_cashback_base_amount >= COALESCE(v_tenant.cashback_minimum_amount, 0) AND NOT v_existing_cashback THEN
        v_cashback_earned := (v_cashback_base_amount * v_tenant.cashback_percentage) / 100;
        
        IF v_cashback_earned > 0 THEN
            -- Inserir usando ON CONFLICT para redundância extrema
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_earned, 'credit', 
                'Cashback gerado no atendimento ' || COALESCE(v_appt.service_name, '')
            ) ON CONFLICT (appointment_id) DO NOTHING;
        END IF;
    END IF;

    -- 6. Debitar Créditos/Cashback usados (se existirem e não tiverem sido debitados)
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) SELECT v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_credit_used, 'debit', 'Uso de créditos no atendimento'
          WHERE NOT EXISTS (SELECT 1 FROM public.credit_transactions WHERE appointment_id = p_appointment_id AND type = 'debit')
          ON CONFLICT (appointment_id) DO NOTHING;
    END IF;

    IF v_cashback_used > 0 THEN
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) SELECT v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_used, 'debit', 'Uso de cashback no atendimento'
          WHERE NOT EXISTS (SELECT 1 FROM public.cashback_transactions WHERE appointment_id = p_appointment_id AND type = 'debit')
          ON CONFLICT (appointment_id) DO NOTHING;
    END IF;

    -- 7. Atualizar agendamento
    UPDATE public.appointments 
    SET 
        status = 'completed',
        payment_status = v_payment_status,
        payment_method = v_payment_method,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 8. Log de status
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source
    ) VALUES (
        p_appointment_id, v_appt.status, 'completed', p_changed_by_type, p_changed_by_id, p_source
    );

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_earned,
        'final_amount', v_final_amount
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;