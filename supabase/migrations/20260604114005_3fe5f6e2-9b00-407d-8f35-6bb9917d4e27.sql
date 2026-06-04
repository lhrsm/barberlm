-- 1. Criar função para resolver a chave do workflow
CREATE OR REPLACE FUNCTION public.get_workflow_key_for_event(p_event_name TEXT, p_flow_type TEXT DEFAULT 'single')
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN p_event_name = 'appointment.created' AND p_flow_type = 'single' THEN 'confirmation_single'
        WHEN p_event_name = 'appointment.created' AND p_flow_type = 'multi' THEN 'confirmation_multi'
        WHEN p_event_name = 'appointment.completed' THEN 'post_service'
        WHEN p_event_name = 'appointment.cancelled' THEN 'appointment_cancelled'
        WHEN p_event_name = 'appointment.rescheduled' THEN 'appointment_rescheduled'
        WHEN p_event_name = 'appointment.reminder' THEN 'appointment_reminder'
        WHEN p_event_name = 'customer.birthday' THEN 'customer_birthday'
        WHEN p_event_name = 'customer.inactive' THEN 'inactive_customer'
        WHEN p_event_name = 'credit.created' THEN 'credit_created'
        WHEN p_event_name = 'cashback.created' THEN 'cashback_created'
        WHEN p_event_name = 'payment.confirmed' THEN 'payment_confirmed'
        WHEN p_event_name = 'payment.pending' THEN 'payment_pending'
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Garantir que os workflows padrão existem com a estrutura correta
CREATE OR REPLACE FUNCTION public.seed_default_workflows_v2()
RETURNS VOID AS $$
DECLARE
    t_id uuid;
BEGIN
    FOR t_id IN SELECT id FROM profiles LOOP
        -- Lista exaustiva de workflows conforme solicitado
        -- Use INSERT ON CONFLICT para não duplicar
        
        -- confirmation_single
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'confirmation_single', 'Confirmação de Agendamento Único', 'appointment.created', true, jsonb_build_object('flow_type', 'single'))
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

        -- confirmation_multi
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'confirmation_multi', 'Confirmação de Múltiplos Agendamentos', 'appointment.created', true, jsonb_build_object('flow_type', 'multi'))
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

        -- appointment_cancelled
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_cancelled', 'Cancelamento de Agendamento', 'appointment.cancelled', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.cancelled';

        -- appointment_rescheduled
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_rescheduled', 'Reagendamento de Agendamento', 'appointment.rescheduled', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.rescheduled';

        -- appointment_reminder
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_reminder', 'Lembrete de Agendamento', 'appointment.reminder', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.reminder';

        -- customer_birthday
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'customer_birthday', 'Aniversário do Cliente', 'customer.birthday', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'customer.birthday';

        -- inactive_customer
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'inactive_customer', 'Cliente Inativo', 'customer.inactive', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'customer.inactive';

        -- post_service
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'post_service', 'Pós-atendimento', 'appointment.completed', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.completed';

        -- review_request
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'review_request', 'Pedido de Avaliação', 'appointment.completed', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.completed';

        -- credit_created
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'credit_created', 'Crédito Adicionado', 'credit.created', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'credit.created';

        -- cashback_created
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'cashback_created', 'Cashback Gerado', 'cashback.created', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'cashback.created';

        -- payment_confirmed
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'payment_confirmed', 'Pagamento Confirmado', 'payment.confirmed', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'payment.confirmed';

        -- payment_pending
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'payment_pending', 'Pagamento Pendente', 'payment.pending', true, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'payment.pending';

        -- notify_barbershop_new_appointment
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'notify_barbershop_new_appointment', 'Notificar Barbearia (Novo Agendamento)', 'appointment.created', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

        -- notify_professional_new_appointment
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'notify_professional_new_appointment', 'Notificar Profissional (Novo Agendamento)', 'appointment.created', false, '{}')
        ON CONFLICT (tenant_id, workflow_key) DO UPDATE SET event_name = 'appointment.created';

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar o seed inicial
SELECT public.seed_default_workflows_v2();

-- 3. Função de Gatilho V2 para a Queue
-- Esta função será disparada quando um evento for inserido em automation_events
CREATE OR REPLACE FUNCTION public.tr_queue_automation_v2_func()
RETURNS TRIGGER AS $$
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

    -- Se não houver chave mapeada, abortar silenciosamente para não quebrar a transação
    IF v_workflow_key IS NULL THEN
        INSERT INTO automation_v2_logs (tenant_id, appointment_id, event_name, message, level)
        VALUES (NEW.tenant_id, NEW.entity_id, NEW.event_name, 'workflow_key_missing_for_event', 'warning');
        RETURN NEW;
    END IF;

    -- Verificar se o workflow existe e está ativo para este tenant
    SELECT id INTO v_workflow_id
    FROM automation_v2_workflows
    WHERE tenant_id = NEW.tenant_id
      AND workflow_key = v_workflow_key
      AND active = true;

    -- Se o workflow não existe ou está inativo
    IF v_workflow_id IS NULL THEN
        INSERT INTO automation_v2_logs (tenant_id, appointment_id, event_name, message, level, metadata)
        VALUES (
            NEW.tenant_id, 
            NEW.entity_id, 
            NEW.event_name, 
            'workflow_not_found_or_inactive', 
            'info', 
            jsonb_build_object('workflow_key', v_workflow_key)
        );
        RETURN NEW;
    END IF;

    -- Inserir na Queue V2
    -- IMPORTANTE: workflow_key agora nunca será NULL aqui
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
    -- Proteção total: logar erro mas não falhar a inserção do evento
    INSERT INTO automation_v2_logs (tenant_id, appointment_id, event_name, message, level, metadata)
    VALUES (NEW.tenant_id, NEW.entity_id, NEW.event_name, 'error_queueing_v2: ' || SQLERRM, 'error', NEW.payload);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Registrar o Gatilho na tabela automation_events
-- Primeiro remover gatilhos antigos se existirem
DROP TRIGGER IF EXISTS tr_queue_automation_v2 ON public.automation_events;

CREATE TRIGGER tr_queue_automation_v2
AFTER INSERT ON public.automation_events
FOR EACH ROW EXECUTE FUNCTION public.tr_queue_automation_v2_func();

-- 5. Atualizar gatilho de criação de cashback para disparar evento
CREATE OR REPLACE FUNCTION public.trigger_cashback_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.type = 'cashback_earned' THEN
        INSERT INTO public.automation_events (
            tenant_id, 
            event_name, 
            entity_type, 
            entity_id, 
            payload,
            appointment_group_id
        ) 
        SELECT 
            NEW.tenant_id, 
            'cashback.created', 
            'cashback', 
            NEW.id, 
            jsonb_build_object('cashback', row_to_json(NEW)),
            a.appointment_group_id
        FROM appointments a
        WHERE a.id = NEW.appointment_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_automation_cashback_event ON public.cashback_transactions;
CREATE TRIGGER tr_automation_cashback_event
AFTER INSERT ON public.cashback_transactions
FOR EACH ROW EXECUTE FUNCTION public.trigger_cashback_event();
