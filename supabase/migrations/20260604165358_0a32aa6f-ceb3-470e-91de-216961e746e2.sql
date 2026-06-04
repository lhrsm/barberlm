-- 1. Função para disparar automações de agendamento diretamente para a fila
CREATE OR REPLACE FUNCTION public.trigger_appointment_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_event_name TEXT;
    v_tenant_id UUID;
    v_workflow RECORD;
BEGIN
    v_tenant_id := NEW.tenant_id;
    
    -- Determinar o nome do evento baseado na ação/status
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

    -- Buscar todos os templates ativos para este evento e tenant
    FOR v_workflow IN 
        SELECT id, key FROM public.automation_templates 
        WHERE tenant_id = v_tenant_id 
        AND trigger_event = v_event_name 
        AND active = true
    LOOP
        -- Inserir na fila de processamento
        INSERT INTO public.automation_queue (
            tenant_id,
            automation_id,
            appointment_id,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_tenant_id,
            v_workflow.id,
            NEW.id,
            'pending',
            now(),
            now()
        );

        -- Registrar log de diagnóstico (Audit)
        INSERT INTO public.automation_logs (
            tenant_id,
            automation_id,
            appointment_id,
            status,
            message_type,
            created_at,
            payload
        ) VALUES (
            v_tenant_id,
            v_workflow.id,
            NEW.id,
            'pending',
            v_workflow.key,
            now(),
            jsonb_build_object(
                'diagnostic', 'automation_triggered',
                'event', v_event_name,
                'queue_status', 'pending'
            )
        );
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Logar erro em uma tabela de erro se necessário, mas não impedir a criação do agendamento
    RAISE NOTICE 'Erro ao disparar automação: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar ou atualizar o gatilho na tabela appointments
DROP TRIGGER IF EXISTS on_appointment_change ON public.appointments;
CREATE TRIGGER on_appointment_change
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trigger_appointment_automation();
