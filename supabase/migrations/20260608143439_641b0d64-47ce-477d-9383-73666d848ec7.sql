-- 1. Create a helper function to get or create a valid automation record
CREATE OR REPLACE FUNCTION public.get_or_create_automation(
    p_tenant_id UUID,
    p_type TEXT,
    p_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_trigger_type TEXT := 'event';
BEGIN
    -- Try to find existing automation
    SELECT id INTO v_id FROM public.automations
    WHERE tenant_id = p_tenant_id AND type = p_type
    LIMIT 1;

    -- If not found, create one
    IF v_id IS NULL THEN
        -- Map type to a friendly name if not provided
        IF p_name IS NULL THEN
            p_name := CASE 
                WHEN p_type = 'new_appointment' THEN 'Novo agendamento'
                WHEN p_type = 'appointment_confirmation' THEN 'Confirmação de agendamento'
                WHEN p_type = 'appointment_reminder' THEN 'Lembrete de agendamento'
                WHEN p_type = 'cancellation' THEN 'Cancelamento'
                WHEN p_type = 'rescheduling' THEN 'Reagendamento'
                WHEN p_type = 'post_service' THEN 'Pós-atendimento'
                WHEN p_type = 'inactive_customer' THEN 'Cliente inativo'
                ELSE 'Automação ' || p_type
            END;
        END IF;

        INSERT INTO public.automations (
            tenant_id, 
            type, 
            name, 
            enabled, 
            trigger_type, 
            trigger_delay,
            channel
        ) VALUES (
            p_tenant_id, 
            p_type, 
            p_name, 
            true, 
            v_trigger_type, 
            0,
            'whatsapp'
        )
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update trigger_appointment_automation to use valid automation_id
CREATE OR REPLACE FUNCTION public.trigger_appointment_automation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_event_name TEXT;
    v_automation_type TEXT;
    v_tenant_id UUID;
    v_workflow RECORD;
    v_automation_id UUID;
    v_customer_phone TEXT;
BEGIN
    v_tenant_id := NEW.tenant_id;

    -- 1. Detecção do Evento
    IF TG_OP = 'INSERT' THEN
        v_event_name := 'appointment.created';
        v_automation_type := 'new_appointment';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status = 'confirmed' THEN 
                v_event_name := 'appointment.confirmed';
                v_automation_type := 'appointment_confirmation';
            ELSIF NEW.status = 'cancelled' THEN 
                v_event_name := 'appointment.cancelled';
                v_automation_type := 'cancellation';
            ELSIF NEW.status = 'completed' THEN 
                v_event_name := 'appointment.completed';
                v_automation_type := 'post_service';
            ELSE 
                v_event_name := 'appointment.updated';
                v_automation_type := 'rescheduling';
            END IF;
        ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
            v_event_name := 'appointment.rescheduled';
            v_automation_type := 'rescheduling';
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- 2. Buscar telefone do cliente
    SELECT phone INTO v_customer_phone FROM public.customers WHERE id = NEW.customer_id;

    -- 3. Obter ID de automação válido da tabela public.automations
    v_automation_id := public.get_or_create_automation(v_tenant_id, v_automation_type);

    -- 4. Loop pelos templates para enfileirar (se existirem)
    FOR v_workflow in 
        SELECT id, key, active FROM public.automation_templates 
        WHERE tenant_id = v_tenant_id 
        AND trigger_event = v_event_name
    LOOP
        IF v_workflow.active THEN
            IF v_customer_phone IS NULL OR v_customer_phone = '' THEN
                -- Log de Telefone Ausente
                INSERT INTO public.automation_logs (
                    tenant_id, automation_id, appointment_id, status, message_type, phone, payload, error_message
                ) VALUES (
                    v_tenant_id, v_automation_id, NEW.id, 'error', v_workflow.key, v_customer_phone,
                    jsonb_build_object('diagnostic', 'customer_phone_missing', 'origin', 'automatic'),
                    'customer_phone_missing'
                );
                CONTINUE;
            END IF;

            -- Inserir na fila
            INSERT INTO public.automation_queue (
                tenant_id, automation_id, appointment_id, status, created_at, updated_at, idempotency_key
            ) VALUES (
                v_tenant_id, v_workflow.id, NEW.id, 'pending', now(), now(), v_workflow.key || ':' || NEW.id
            ) ON CONFLICT (idempotency_key) DO NOTHING;

            -- Registrar log de diagnóstico (Detectado)
            INSERT INTO public.automation_logs (
                tenant_id, automation_id, appointment_id, status, message_type, phone, payload
            ) VALUES (
                v_tenant_id, v_automation_id, NEW.id, 'pending', v_workflow.key, v_customer_phone,
                jsonb_build_object('diagnostic', 'automation_detected', 'origin', 'automatic')
            ) ON CONFLICT (idempotency_key) DO NOTHING;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$function$;

-- 3. Clean up orphaned logs (those with automation_id not in automations)
-- First set them to NULL to avoid constraint violation if we decide to keep them, 
-- or just delete them if they are just logs.
-- The user said: "remover apenas logs técnicos inválidos, sem apagar agendamentos, pagamentos ou clientes"
DELETE FROM public.automation_logs 
WHERE automation_id IS NOT NULL 
AND automation_id NOT IN (SELECT id FROM public.automations);

-- 4. Update the foreign key constraint to be safer (ON DELETE SET NULL)
ALTER TABLE public.automation_logs 
DROP CONSTRAINT IF EXISTS automation_logs_automation_id_fkey;

ALTER TABLE public.automation_logs 
ADD CONSTRAINT automation_logs_automation_id_fkey 
FOREIGN KEY (automation_id) 
REFERENCES public.automations(id) 
ON DELETE SET NULL;
