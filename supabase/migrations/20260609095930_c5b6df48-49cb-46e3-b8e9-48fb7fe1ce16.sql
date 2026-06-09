-- 1. Expand refund_status check constraint
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_refund_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_refund_status_check 
CHECK (refund_status = ANY (ARRAY[
    'none', 
    'not_applicable', 
    'refund_requested', 
    'refund_approved', 
    'refund_rejected', 
    'refunded', 
    'converted_to_credit',
    'pending',
    'requested',
    'approved',
    'completed',
    'cancelled'
]));

-- 2. Prevent duplicate confirmation enqueues at DB level
-- We use a unique index that only applies to confirmed appointments enqueues
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_unique_confirmation 
ON public.automation_queue (appointment_id, workflow_key) 
WHERE (workflow_key = 'appointment_confirmation' AND status IN ('pending', 'processing', 'success'));

-- 3. Refine the automation trigger function to handle UPDATES and be idempotent
CREATE OR REPLACE FUNCTION public.fn_on_appointment_created_enqueue_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
 DECLARE
     v_automation_id UUID;
     v_exists BOOLEAN;
 BEGIN
     -- Só processa para agendamentos confirmados (ou que acabaram de ser confirmados)
     IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN
         
         -- Se for um UPDATE, só prossegue se o status mudo para confirmed ou se não havia sido enfileirado antes
         IF TG_OP = 'UPDATE' THEN
            IF OLD.status = 'confirmed' THEN
                -- Se já estava confirmado, verifica se já existe uma fila para evitar duplicidade em atualizações triviais
                SELECT EXISTS (
                    SELECT 1 FROM public.automation_queue
                    WHERE appointment_id = NEW.id
                    AND workflow_key = 'appointment_confirmation'
                    AND status IN ('pending', 'processing', 'success')
                ) INTO v_exists;
                
                IF v_exists THEN
                    RETURN NEW;
                END IF;
            END IF;
         END IF;

         -- 1. Buscar ID do template de confirmação
         SELECT id INTO v_automation_id
         FROM public.automation_templates
         WHERE tenant_id = NEW.tenant_id AND key = 'appointment_confirmation'
         LIMIT 1;
         
         -- 2. Se não existir, criar um template padrão para este tenant
         IF v_automation_id IS NULL THEN
             INSERT INTO public.automation_templates (
                 tenant_id,
                 key,
                 name,
                 trigger_event,
                 template,
                 active
             ) VALUES (
                 NEW.tenant_id,
                 'appointment_confirmation',
                 'Confirmação de Agendamento',
                 'appointment_created',
                 'Olá, {customer_name}! 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nPara reagendar ou cancelar, acesse o link abaixo:\n{management_link}\n\nObrigado!',
                 true
             ) ON CONFLICT (tenant_id, key) DO UPDATE SET tenant_id = EXCLUDED.tenant_id RETURNING id INTO v_automation_id;
         END IF;

         -- 3. Verificação final de idempotência (redundante com o índice mas bom para lógica)
         SELECT EXISTS (
             SELECT 1 FROM public.automation_queue
             WHERE (appointment_id = NEW.id OR (NEW.appointment_group_id IS NOT NULL AND appointment_group_id = NEW.appointment_group_id))
             AND workflow_key = 'appointment_confirmation'
             AND status IN ('pending', 'processing', 'success')
         ) INTO v_exists;
         
         IF v_exists THEN
             RETURN NEW;
         END IF;

         -- 4. Inserir na fila de automação
         INSERT INTO public.automation_queue (
             tenant_id,
             automation_id,
             appointment_id,
             appointment_group_id,
             customer_id,
             automation_type,
             workflow_key,
             status,
             attempts,
             scheduled_for
         ) VALUES (
             NEW.tenant_id,
             v_automation_id,
             NEW.id,
             NEW.appointment_group_id,
             NEW.customer_id,
             'new_appointment',
             'appointment_confirmation',
             'pending',
             0,
             now()
         ) ON CONFLICT DO NOTHING;
     END IF;
     
     RETURN NEW;
 END;
$function$;

-- Ensure trigger runs on INSERT and UPDATE
DROP TRIGGER IF EXISTS tr_enqueue_new_appointment ON public.appointments;
CREATE TRIGGER tr_enqueue_new_appointment 
AFTER INSERT OR UPDATE OF status ON public.appointments 
FOR EACH ROW EXECUTE FUNCTION fn_on_appointment_created_enqueue_automation();
