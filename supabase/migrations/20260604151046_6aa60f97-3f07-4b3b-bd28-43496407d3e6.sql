-- 1. Remover Triggers problemáticos que ligam agendamentos à automação V2
DROP TRIGGER IF EXISTS tr_automation_appointment_event ON public.appointments;
DROP TRIGGER IF EXISTS tr_automation_customer_event ON public.customers;
DROP TRIGGER IF EXISTS tr_queue_automation_event ON public.automation_events;
DROP TRIGGER IF EXISTS tr_queue_automation_v2 ON public.automation_events;

-- 2. Restaurar funções core sem dependências da V2
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid, 
    p_changed_by_type text DEFAULT 'admin'::text, 
    p_changed_by_id uuid DEFAULT NULL::uuid, 
    p_source text DEFAULT 'system'::text, 
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_cashback_percentage DECIMAL(10, 2) := 0;
    v_cashback_amount DECIMAL(10, 2) := 0;
    v_already_earned BOOLEAN := FALSE;
    v_result JSONB;
    v_final_amount DECIMAL(10, 2);
    v_credit_used DECIMAL(10, 2);
    v_cashback_used DECIMAL(10, 2);
    v_payment_status TEXT;
    v_new_cashback_balance DECIMAL(10, 2);
    v_new_credit_balance DECIMAL(10, 2);
    v_deduction_text TEXT := '';
    v_cashback_earned DECIMAL(10, 2) := 0; 
BEGIN
    -- Buscar agendamento
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já está concluído');
    END IF;

    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;

    -- Aplicar Metadados
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'pending');
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, (v_appt.total_price - v_credit_used - v_cashback_used));

    -- Cashback usado
    IF v_cashback_used > 0 THEN
        UPDATE public.customers SET cashback_balance = COALESCE(cashback_balance, 0) - v_cashback_used WHERE id = v_appt.customer_id;
        INSERT INTO public.cashback_transactions (tenant_id, customer_id, appointment_id, type, amount, base_amount, description)
        VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_used', -v_cashback_used, v_appt.total_price, 'Cashback utilizado no agendamento');
    END IF;

    -- Créditos usados
    IF v_credit_used > 0 THEN
        UPDATE public.customers SET credits = COALESCE(credits, 0) - v_credit_used WHERE id = v_appt.customer_id;
        INSERT INTO public.credit_transactions (tenant_id, customer_id, appointment_id, type, amount, description)
        VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'credit_used', -v_credit_used, 'Uso de créditos no agendamento');
    END IF;

    -- Atualizar agendamento
    UPDATE public.appointments SET
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        amount_paid = v_final_amount,
        status = 'completed',
        completed_at = now(),
        completed_by = p_changed_by_type,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- Ganho de Cashback
    IF COALESCE(v_tenant.cashback_enabled, false) AND v_payment_status = 'paid' THEN
        SELECT EXISTS (SELECT 1 FROM public.cashback_transactions WHERE appointment_id = p_appointment_id AND type = 'cashback_earned') INTO v_already_earned;
        IF NOT v_already_earned THEN
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
            v_cashback_earned := (v_appt.total_price * v_cashback_percentage) / 100;
            IF v_cashback_earned > 0 THEN
                UPDATE public.customers SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned WHERE id = v_appt.customer_id;
                INSERT INTO public.cashback_transactions (tenant_id, customer_id, appointment_id, type, amount, base_amount, description)
                VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_earned, v_appt.total_price, 'Cashback ganho no agendamento');
            END IF;
        END IF;
    END IF;

    -- Registrar log de status
    INSERT INTO appointment_status_logs (appointment_id, old_status, new_status, changed_by_type, changed_by_id, source)
    VALUES (p_appointment_id, v_appt.status, 'completed', p_changed_by_type, p_changed_by_id, p_source);

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id uuid, 
    p_cancelled_by text, 
    p_source text, 
    p_refund_preference text DEFAULT 'none'::text, 
    p_changed_by_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_appt RECORD;
    v_credits_to_refund DECIMAL(10, 2) := 0;
BEGIN
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Já cancelado');
    END IF;

    -- Estorno básico de créditos
    v_credits_to_refund := COALESCE(v_appt.credit_used, 0);
    IF v_credits_to_refund > 0 THEN
        UPDATE customers SET credits = COALESCE(credits, 0) + v_credits_to_refund WHERE id = v_appt.customer_id;
        INSERT INTO credit_transactions (tenant_id, customer_id, appointment_id, type, amount, description)
        VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'credit_refund', v_credits_to_refund, 'Estorno de créditos por cancelamento');
    END IF;

    -- Atualizar status
    UPDATE appointments SET 
        status = 'cancelled', 
        cancelled_at = now(), 
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        updated_at = now() 
    WHERE id = p_appointment_id;

    -- Log
    INSERT INTO appointment_status_logs (appointment_id, old_status, new_status, changed_by_type, changed_by_id, source)
    VALUES (p_appointment_id, v_appt.status, 'cancelled', p_cancelled_by, p_changed_by_id, p_source);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Restaurar tabelas originais se foram renomeadas
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_automation_logs') THEN
        DROP TABLE IF EXISTS public.automation_logs CASCADE;
        ALTER TABLE public.legacy_automation_logs RENAME TO automation_logs;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_whatsapp_conversations') THEN
        DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;
        ALTER TABLE public.legacy_whatsapp_conversations RENAME TO whatsapp_conversations;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_automation_conversations') THEN
        DROP TABLE IF EXISTS public.automation_conversations CASCADE;
        ALTER TABLE public.legacy_automation_conversations RENAME TO automation_conversations;
    END IF;
END $$;

-- 4. Remover tabelas V2 (mantendo os dados por segurança se necessário, mas aqui vamos dropar as novas)
DROP TABLE IF EXISTS public.automation_v2_logs CASCADE;
DROP TABLE IF EXISTS public.automation_v2_queue CASCADE;
DROP TABLE IF EXISTS public.automation_v2_sessions CASCADE;
DROP TABLE IF EXISTS public.automation_v2_webhook_logs CASCADE;
DROP TABLE IF EXISTS public.automation_v2_workflows CASCADE;
DROP TABLE IF EXISTS public.automation_queue CASCADE;
DROP TABLE IF EXISTS public.automation_workflows CASCADE;
DROP TABLE IF EXISTS public.automation_events CASCADE;
DROP TABLE IF EXISTS public.conversation_sessions CASCADE;
DROP TABLE IF EXISTS public.messaging_providers CASCADE;
DROP TABLE IF EXISTS public.messaging_v2_providers CASCADE;

-- 5. Garantir que as colunas legadas em appointments ainda funcionam
-- (Muitas vezes as migrations da V2 adicionam colunas, vamos mantê-las mas garantir que as triggers não as tornem obrigatórias)
ALTER TABLE IF EXISTS public.appointments ALTER COLUMN tenant_id SET NOT NULL;
