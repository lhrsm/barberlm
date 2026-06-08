-- 1. Atualizar a função do gatilho para ser mais robusta com logs
CREATE OR REPLACE FUNCTION public.fn_on_appointment_created_enqueue_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_exists BOOLEAN;
    v_automation_id UUID;
BEGIN
    -- Só processa para agendamentos confirmados com dados necessários
    IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND NEW.tenant_id IS NOT NULL AND NEW.management_token IS NOT NULL THEN
        
        -- Buscar ID da automação (template) correspondente
        SELECT id INTO v_automation_id 
        FROM public.automation_templates 
        WHERE tenant_id = NEW.tenant_id AND key = 'appointment_confirmation'
        LIMIT 1;

        -- Se não existir automação configurada, podemos tentar buscar em automations (tabela relacionada)
        IF v_automation_id IS NULL THEN
            SELECT id INTO v_automation_id 
            FROM public.automations 
            WHERE tenant_id = NEW.tenant_id AND type = 'appointment_confirmation'
            LIMIT 1;
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
            );

            -- Registro de auditoria em logs
            -- Graças à migração anterior, automation_id pode ser NULL aqui se não encontramos template
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
                'new_appointment',
                jsonb_build_object(
                    'diagnostic', 'automation_queue_created',
                    'trigger', 'database_trigger',
                    'has_configured_template', (v_automation_id IS NOT NULL)
                )
            );
        ELSE
            -- Log de duplicidade ignorada
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
                'skipped',
                'new_appointment',
                jsonb_build_object(
                    'diagnostic', 'duplicate_confirmation_blocked',
                    'reason', 'already_in_queue'
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
