CREATE OR REPLACE FUNCTION public.trigger_appointment_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_event_name TEXT;
    v_tenant_id UUID;
    v_workflow RECORD;
    v_template_found BOOLEAN := false;
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

    -- 2. Buscar telefone do cliente
    SELECT phone INTO v_customer_phone FROM public.customers WHERE id = NEW.customer_id;

    -- 3. Loop pelos templates
    FOR v_workflow in 
        SELECT id, key, active FROM public.automation_templates 
        WHERE tenant_id = v_tenant_id 
        AND trigger_event = v_event_name 
    LOOP
        v_template_found := true;

        IF v_workflow.active THEN
            IF v_customer_phone IS NULL OR v_customer_phone = '' THEN
                -- Log de Telefone Ausente
                INSERT INTO public.automation_logs (
                    tenant_id, automation_id, appointment_id, status, message_type, phone, payload, error_message
                ) VALUES (
                    v_tenant_id, v_workflow.id, NEW.id, 'error', v_workflow.key, v_customer_phone,
                    jsonb_build_object('diagnostic', 'customer_phone_missing', 'origin', 'automatic'),
                    'customer_phone_missing'
                );
                CONTINUE;
            END IF;

            -- Inserir na fila com idempotência
            INSERT INTO public.automation_queue (
                tenant_id, automation_id, appointment_id, status, created_at, updated_at, idempotency_key
            ) VALUES (
                v_tenant_id, v_workflow.id, NEW.id, 'pending', now(), now(), v_workflow.key || ':' || NEW.id
            ) ON CONFLICT (idempotency_key) DO NOTHING;

            -- Registrar log de diagnóstico (Detectado)
            -- Usar INSERT ... ON CONFLICT para evitar duplicar log de diagnóstico se o trigger rodar de novo
            INSERT INTO public.automation_logs (
                tenant_id, automation_id, appointment_id, status, message_type, phone, payload, idempotency_key
            ) VALUES (
                v_tenant_id, v_workflow.id, NEW.id, 'pending', v_workflow.key, v_customer_phone,
                jsonb_build_object(
                    'diagnostic', 'trigger_executed',
                    'appointment_created_detected', true,
                    'event', v_event_name,
                    'origin', 'automatic'
                ),
                'diag:' || v_workflow.key || ':' || NEW.id
            ) ON CONFLICT (idempotency_key) DO NOTHING;
        ELSE
            -- Log de Template Inativo
            INSERT INTO public.automation_logs (
                tenant_id, automation_id, appointment_id, status, message_type, phone, payload, error_message, idempotency_key
            ) VALUES (
                v_tenant_id, v_workflow.id, NEW.id, 'error', v_workflow.key, v_customer_phone,
                jsonb_build_object('diagnostic', 'template_inactive', 'origin', 'automatic'),
                'template_inactive',
                'diag:' || v_workflow.key || ':' || NEW.id
            ) ON CONFLICT (idempotency_key) DO NOTHING;
        END IF;
    END LOOP;

    -- 4. Se nenhum template foi encontrado para um evento que deveria ter (como created)
    IF NOT v_template_found AND v_event_name = 'appointment.created' THEN
        -- Log genérico sem automation_id
        INSERT INTO public.automation_logs (
            tenant_id, appointment_id, status, message_type, phone, payload, error_message
        ) VALUES (
            v_tenant_id, NEW.id, 'error', 'none', v_customer_phone,
            jsonb_build_object('diagnostic', 'template_not_found', 'event', v_event_name, 'origin', 'automatic'),
            'template_not_found'
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ao disparar automação: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;