-- 1. Corrigir schema de automation_v2_logs
ALTER TABLE public.automation_v2_logs 
ADD COLUMN IF NOT EXISTS appointment_id UUID,
ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'info',
ADD COLUMN IF NOT EXISTS workflow_key TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Garantir GRANTs
GRANT ALL ON public.automation_v2_logs TO authenticated, service_role;

-- 2. Corrigir schema de appointments
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

-- 3. Unificar e Corrigir complete_appointment
-- Primeiro removemos as versões existentes para evitar conflitos de overload
DROP FUNCTION IF EXISTS public.complete_appointment(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.complete_appointment(uuid, text, uuid, text, jsonb);

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
    -- 1. Buscar agendamento e configurações do tenant (perfil)
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Se já estiver concluído, apenas retornar sucesso
    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já está concluído');
    END IF;

    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;

    -- 2. Aplicar Metadados (Pagamento, Créditos Usados, etc.)
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'pending');
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, (v_appt.total_price - v_credit_used - v_cashback_used));

    -- 3. Lógica de Desconto de Cashback (Se utilizado)
    IF v_cashback_used > 0 THEN
        UPDATE public.customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) - v_cashback_used,
            updated_at = now()
        WHERE id = v_appt.customer_id
        RETURNING cashback_balance INTO v_new_cashback_balance;

        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_used', -v_cashback_used, v_appt.total_price, 'Cashback utilizado no agendamento'
        );
        
        v_deduction_text := v_deduction_text || ' (Cashback: R$ ' || v_cashback_used || ')';
    END IF;

    -- 4. Lógica de Desconto de Créditos (Se utilizado)
    IF v_credit_used > 0 THEN
        UPDATE public.customers 
        SET credits = COALESCE(credits, 0) - v_credit_used,
            updated_at = now()
        WHERE id = v_appt.customer_id
        RETURNING credits INTO v_new_credit_balance;
        
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'credit_used', -v_credit_used, 'Uso de créditos no agendamento'
        );

        v_deduction_text := v_deduction_text || ' (Créditos: R$ ' || v_credit_used || ')';
    END IF;

    -- 5. Atualizar o agendamento com as informações de pagamento
    UPDATE public.appointments SET
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        amount_paid = v_final_amount, -- Sincronizar campo amount_paid
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 6. Lógica de Ganho de Cashback
    IF COALESCE(v_tenant.cashback_enabled, false) AND v_payment_status = 'paid' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'cashback_earned'
        ) INTO v_already_earned;

        IF NOT v_already_earned THEN
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
            IF v_cashback_percentage > 0 THEN
                v_cashback_earned := (v_appt.total_price * v_cashback_percentage) / 100;
                v_cashback_amount := v_cashback_earned;
            END IF;
        END IF;
    END IF;

    -- 7. Atualizar status para concluído usando função central
    v_result := public.update_appointment_status(
        p_appointment_id, 
        'completed', 
        p_changed_by_type, 
        p_changed_by_id, 
        p_source,
        p_metadata || jsonb_build_object(
            'cashback_earned', v_cashback_earned,
            'total_price', v_appt.total_price
        )
    );

    IF NOT (v_result->>'success')::boolean THEN
        RETURN v_result;
    END IF;

    -- 8. Efetivar ganho de cashback se calculado
    IF v_cashback_amount > 0 AND NOT v_already_earned THEN
        UPDATE public.customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount,
            updated_at = now()
        WHERE id = v_appt.customer_id;

        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_amount, v_appt.total_price, 'Cashback por atendimento concluído'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_amount,
        'new_status', 'completed'
    );
END;
$$;

-- 4. Corrigir trigger tr_queue_automation_v2_func
CREATE OR REPLACE FUNCTION public.tr_queue_automation_v2_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_flow_type TEXT := 'single';
    v_appt_count INTEGER := 0;
    v_workflow_key TEXT;
    v_workflow_id UUID;
BEGIN
    -- Determinar flow_type se for agendamento
    IF NEW.appointment_group_id IS NOT NULL THEN
        SELECT count(*) INTO v_appt_count 
        FROM public.appointments 
        WHERE appointment_group_id = NEW.appointment_group_id;
        
        IF v_appt_count > 1 THEN
            v_flow_type := 'multi';
        END IF;
    END IF;

    -- Obter a chave do workflow baseada no evento
    v_workflow_key := public.get_workflow_key_for_event(NEW.event_name, v_flow_type);

    -- Se não houver chave mapeada, abortar silenciosamente
    IF v_workflow_key IS NULL THEN
        INSERT INTO public.automation_v2_logs (tenant_id, appointment_id, event_name, message, level)
        VALUES (NEW.tenant_id, NEW.entity_id, NEW.event_name, 'workflow_key_missing_for_event', 'warning');
        RETURN NEW;
    END IF;

    -- Verificar se o workflow existe e está ativo
    SELECT id INTO v_workflow_id
    FROM public.automation_v2_workflows
    WHERE tenant_id = NEW.tenant_id
      AND workflow_key = v_workflow_key
      AND active = true;

    -- Se o workflow não existe ou está inativo
    IF v_workflow_id IS NULL THEN
        INSERT INTO public.automation_v2_logs (tenant_id, appointment_id, event_name, workflow_key, message, level)
        VALUES (
            NEW.tenant_id, 
            NEW.entity_id, 
            NEW.event_name, 
            v_workflow_key,
            'workflow_not_found_or_inactive', 
            'info'
        );
        RETURN NEW;
    END IF;

    -- Inserir na Queue V2
    INSERT INTO public.automation_v2_queue (
        tenant_id,
        appointment_id,
        appointment_group_id,
        workflow_id,
        workflow_key,
        event_name,
        flow_type,
        status,
        scheduled_for,
        metadata
    ) VALUES (
        NEW.tenant_id,
        NEW.entity_id,
        NEW.appointment_group_id,
        v_workflow_id,
        v_workflow_key,
        NEW.event_name,
        v_flow_type,
        'pending',
        now(),
        NEW.payload
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Proteção total corrigida
    INSERT INTO public.automation_v2_logs (tenant_id, appointment_id, event_name, message, level, metadata)
    VALUES (NEW.tenant_id, NEW.entity_id, NEW.event_name, 'error_queueing_v2: ' || SQLERRM, 'error', NEW.payload);
    RETURN NEW;
END;
$$;
