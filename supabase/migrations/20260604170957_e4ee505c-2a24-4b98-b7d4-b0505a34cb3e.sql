-- 1. Melhorar a função de gatilho para ser mais diagnóstica
CREATE OR REPLACE FUNCTION public.trigger_appointment_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_event_name TEXT;
    v_tenant_id UUID;
    v_workflow RECORD;
    v_template_found BOOLEAN := false;
    v_template_active BOOLEAN := false;
    v_customer_phone TEXT;
BEGIN
    v_tenant_id := NEW.tenant_id;
    
    -- 1. Detecção do Evento
    IF TG_OP = 'INSERT' THEN
        v_event_name := 'appointment.created';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status = 'confirmed' THEN v_event_name := 'appointment.confirmed';
            ELSIF NEW.status = 'cancelled' THEN v_event_name := 'appointment.cancelled';
            ELSIF NEW.status = 'completed' THEN v_event_name := 'appointment.completed';
            ELSE v_event_name := 'appointment.updated';
            END IF;
        ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
            v_event_name := 'appointment.rescheduled';
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- 2. Buscar telefone do cliente para o log de diagnóstico
    SELECT phone INTO v_customer_phone FROM public.customers WHERE id = NEW.customer_id;

    -- 3. Loop pelos templates
    FOR v_workflow IN 
        SELECT id, key, active FROM public.automation_templates 
        WHERE tenant_id = v_tenant_id 
        AND trigger_event = v_event_name 
    LOOP
        v_template_found := true;
        v_template_active := v_workflow.active;

        IF v_workflow.active THEN
            -- Inserir na fila de processamento
            INSERT INTO public.automation_queue (
                tenant_id,
                automation_id,
                appointment_id,
                status,
                created_at,
                updated_at,
                idempotency_key
            ) VALUES (
                v_tenant_id,
                v_workflow.id,
                NEW.id,
                'pending',
                now(),
                now(),
                v_workflow.key || ':' || NEW.id
            ) ON CONFLICT (idempotency_key) DO NOTHING;

            -- Registrar log de diagnóstico (Sucesso no Gatilho)
            INSERT INTO public.automation_logs (
                tenant_id,
                automation_id,
                appointment_id,
                status,
                message_type,
                created_at,
                phone,
                payload
            ) VALUES (
                v_tenant_id,
                v_workflow.id,
                NEW.id,
                'pending',
                v_workflow.key,
                now(),
                v_customer_phone,
                jsonb_build_object(
                    'diagnostic', 'trigger_executed',
                    'appointment_created_detected', true,
                    'event', v_event_name,
                    'automation_template_found', true,
                    'automation_template_active', true,
                    'customer_phone', v_customer_phone,
                    'origin', 'automatic'
                )
            );
        ELSE
            -- Log de Template Inativo
            INSERT INTO public.automation_logs (
                tenant_id,
                automation_id,
                appointment_id,
                status,
                message_type,
                created_at,
                phone,
                payload,
                error_message
            ) VALUES (
                v_tenant_id,
                v_workflow.id,
                NEW.id,
                'error',
                v_workflow.key,
                now(),
                v_customer_phone,
                jsonb_build_object(
                    'diagnostic', 'template_inactive',
                    'appointment_created_detected', true,
                    'event', v_event_name,
                    'automation_template_found', true,
                    'automation_template_active', false,
                    'origin', 'automatic'
                ),
                'template_inactive'
            );
        END IF;
    END LOOP;

    -- 4. Se nenhum template foi encontrado, logar o erro de diagnóstico (se for um evento relevante)
    IF NOT v_template_found AND v_event_name = 'appointment.created' THEN
        -- Como não temos um automation_id, não podemos inserir em automation_logs facilmente
        -- Mas podemos tentar encontrar pelo menos um ID genérico ou criar um log de erro
        NULL;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log de erro catastrófico no disparo
    RAISE WARNING 'Erro ao disparar automação: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
