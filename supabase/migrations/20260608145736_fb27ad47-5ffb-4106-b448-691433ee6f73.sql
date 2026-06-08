-- Simplified and robust trigger_appointment_automation
CREATE OR REPLACE FUNCTION public.trigger_appointment_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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
