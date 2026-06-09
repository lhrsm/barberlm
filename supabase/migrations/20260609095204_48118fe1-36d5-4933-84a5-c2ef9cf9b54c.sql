-- 1. Clean up orphaned references before adding FK
UPDATE public.appointments a
SET appointment_group_id = NULL
WHERE a.appointment_group_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.appointment_groups g WHERE g.id = a.appointment_group_id);

-- 2. Add missing foreign key for PostgREST joins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_appointment_group_id_fkey'
    ) THEN
        ALTER TABLE public.appointments 
        ADD CONSTRAINT appointments_appointment_group_id_fkey 
        FOREIGN KEY (appointment_group_id) REFERENCES public.appointment_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Refine the automation trigger function
CREATE OR REPLACE FUNCTION public.fn_on_appointment_created_enqueue_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
 DECLARE
     v_automation_id UUID;
     v_exists BOOLEAN;
 BEGIN
     -- Só processa para agendamentos confirmados
     IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN
         
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
             ) RETURNING id INTO v_automation_id;
         END IF;

         -- 3. Se for um agendamento em grupo, verificar se já existe uma fila para este grupo
         IF NEW.appointment_group_id IS NOT NULL THEN
             SELECT EXISTS (
                 SELECT 1 FROM public.automation_queue
                 WHERE appointment_group_id = NEW.appointment_group_id
                 AND workflow_key = 'appointment_confirmation'
                 AND status IN ('pending', 'processing', 'success')
             ) INTO v_exists;
             
             IF v_exists THEN
                 RETURN NEW; -- Já existe uma fila para este grupo, não duplicar
             END IF;
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
         );
     END IF;
     
     RETURN NEW;
 END;
$function$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS tr_enqueue_new_appointment ON public.appointments;
CREATE TRIGGER tr_enqueue_new_appointment 
AFTER INSERT ON public.appointments 
FOR EACH ROW EXECUTE FUNCTION fn_on_appointment_created_enqueue_automation();

-- Ensure permissions are correct
GRANT ALL ON public.automation_queue TO service_role;
GRANT ALL ON public.automation_queue TO authenticated;
GRANT ALL ON public.automation_logs TO service_role;
GRANT ALL ON public.automation_logs TO authenticated;
GRANT ALL ON public.automation_templates TO service_role;
GRANT ALL ON public.automation_templates TO authenticated;
