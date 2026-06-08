-- 1. Ensure get_or_create_automation is correct and robust
CREATE OR REPLACE FUNCTION public.get_or_create_automation(p_tenant_id uuid, p_type text, p_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_id UUID;
    v_trigger_type TEXT := 'event';
BEGIN
    -- Try to find existing automation in the 'automations' table
    -- This table does NOT have a 'name' column
    SELECT id INTO v_id FROM public.automations
    WHERE tenant_id = p_tenant_id AND type = p_type
    LIMIT 1;

    -- If not found, create one
    IF v_id IS NULL THEN
        -- p_name is ignored as the table lacks a 'name' column
        INSERT INTO public.automations (
            tenant_id,
            type,
            enabled,
            trigger_type,
            trigger_delay,
            channel
        ) VALUES (
            p_tenant_id,
            p_type,
            true,
            v_trigger_type,
            0,
            'whatsapp'
        )
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
EXCEPTION WHEN OTHERS THEN
    -- If everything fails, try to return any existing automation for this tenant
    SELECT id INTO v_id FROM public.automations WHERE tenant_id = p_tenant_id LIMIT 1;
    RETURN v_id;
END;
$function$;

-- 2. Update fn_on_appointment_created_enqueue_automation to be non-blocking
CREATE OR REPLACE FUNCTION public.fn_on_appointment_created_enqueue_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_exists BOOLEAN;
    v_automation_id UUID;
BEGIN
    -- Wrap everything in a BEGIN/EXCEPTION block to ensure appointments are never blocked
    BEGIN
        -- Só processa para agendamentos confirmados com dados necessários
        IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND NEW.tenant_id IS NOT NULL AND NEW.management_token IS NOT NULL THEN

            -- Buscar ID da automação (template) correspondente
            SELECT id INTO v_automation_id
            FROM public.automation_templates
            WHERE tenant_id = NEW.tenant_id AND key = 'appointment_confirmation'
            LIMIT 1;

            -- Se não existir automação configurada, buscar na tabela 'automations'
            IF v_automation_id IS NULL THEN
                v_automation_id := public.get_or_create_automation(NEW.tenant_id, 'appointment_confirmation');
            END IF;

            -- Verificar duplicidade na fila
            SELECT EXISTS (
                SELECT 1 FROM public.automation_queue
                WHERE appointment_id = NEW.id
                AND (automation_type = 'new_appointment' OR workflow_key = 'appointment_confirmation')
            ) INTO v_exists;

            IF NOT v_exists THEN
                -- Inserir na fila
                INSERT INTO public.automation_queue (
                    tenant_id,
                    appointment_id,
                    customer_id,
                    automation_id,
                    automation_type,
                    workflow_key,
                    status,
                    scheduled_for,
                    attempts,
                    created_at,
                    updated_at
                ) VALUES (
                    NEW.tenant_id,
                    NEW.id,
                    NEW.customer_id,
                    v_automation_id,
                    'new_appointment',
                    'appointment_confirmation',
                    'pending',
                    now(),
                    0,
                    now(),
                    now()
                ) ON CONFLICT (appointment_id, workflow_key) WHERE status = 'pending' DO NOTHING;

                -- Registro de auditoria em logs
                INSERT INTO public.automation_logs (
                    tenant_id,
                    automation_id,
                    appointment_id,
                    customer_id,
                    status,
                    message_type,
                    payload
                ) VALUES (
                    NEW.tenant_id,
                    v_automation_id,
                    NEW.id,
                    NEW.customer_id,
                    'pending',
                    'appointment_confirmation',
                    jsonb_build_object('event', 'appointment_created', 'source', 'trigger_fn')
                );
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Do not re-raise the error, just log it to the console/Postgres logs
        RAISE WARNING 'Error in fn_on_appointment_created_enqueue_automation: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

-- 3. Update tr_handle_appointment_confirmation to be non-blocking
CREATE OR REPLACE FUNCTION public.tr_handle_appointment_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    tpl_record RECORD;
    v_idempotency_key TEXT;
BEGIN
    BEGIN -- Safety block
        -- Only for new appointments
        IF (TG_OP = 'INSERT') THEN
            -- Find active template
            SELECT * INTO tpl_record
            FROM public.automation_templates
            WHERE tenant_id = NEW.tenant_id
            AND key = 'appointment_confirmation'
            AND active = true;

            IF FOUND THEN
                -- Generate key: type + appointment_id
                v_idempotency_key := 'appointment_confirmation:' || NEW.id;

                -- Insert into queue with idempotency check
                INSERT INTO public.automation_queue (tenant_id, automation_id, appointment_id, status, idempotency_key)
                VALUES (NEW.tenant_id, tpl_record.id, NEW.id, 'pending', v_idempotency_key)
                ON CONFLICT (idempotency_key) WHERE status != 'error' DO NOTHING;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in tr_handle_appointment_confirmation: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

-- 4. Re-apply fixed and robust trigger_appointment_automation
CREATE OR REPLACE FUNCTION public.trigger_appointment_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_event_name TEXT;
    v_automation_type TEXT;
    v_tenant_id UUID;
    v_workflow RECORD;
    v_automation_id UUID;
    v_customer_phone TEXT;
BEGIN
    BEGIN -- Outer block for safety
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
        BEGIN
            v_automation_id := public.get_or_create_automation(v_tenant_id, v_automation_type);
        EXCEPTION WHEN OTHERS THEN
            v_automation_id := NULL;
        END;

        -- 4. Loop pelos templates para enfileirar (se existirem)
        FOR v_workflow in
            SELECT id, key, active FROM public.automation_templates
            WHERE tenant_id = v_tenant_id
            AND trigger_event = v_event_name
        LOOP
            IF v_workflow.active THEN
                IF v_customer_phone IS NULL OR v_customer_phone = '' THEN
                    -- Log de Telefone Ausente (non-blocking)
                    BEGIN
                        INSERT INTO public.automation_logs (
                            tenant_id, automation_id, appointment_id, status, message_type, phone, payload, error_message
                        ) VALUES (
                            v_tenant_id, v_automation_id, NEW.id, 'error', v_workflow.key, v_customer_phone,
                            jsonb_build_object('diagnostic', 'customer_phone_missing', 'origin', 'automatic'),
                            'customer_phone_missing'
                        );
                    EXCEPTION WHEN OTHERS THEN
                        -- Ignore logging errors
                    END;
                    CONTINUE;
                END IF;

                -- Inserir na fila
                BEGIN
                    INSERT INTO public.automation_queue (
                        tenant_id,
                        appointment_id,
                        customer_id,
                        automation_id,
                        automation_type,
                        workflow_key,
                        status,
                        scheduled_for,
                        attempts
                    ) VALUES (
                        v_tenant_id,
                        NEW.id,
                        NEW.customer_id,
                        v_workflow.id,
                        v_automation_type,
                        v_workflow.key,
                        'pending',
                        now(),
                        0
                    ) ON CONFLICT (appointment_id, workflow_key) 
                    WHERE status = 'pending' DO NOTHING;
                EXCEPTION WHEN OTHERS THEN
                    -- Ignore queueing errors
                END;
            END IF;
        END LOOP;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in trigger_appointment_automation: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;
