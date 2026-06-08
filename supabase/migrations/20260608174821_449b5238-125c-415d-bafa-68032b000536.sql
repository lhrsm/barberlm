CREATE OR REPLACE FUNCTION public.fn_on_appointment_created_enqueue_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
 DECLARE
     v_exists BOOLEAN;
     v_automation_id UUID;
 BEGIN
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
                     channel,
                     active,
                     template
                 ) VALUES (
                     NEW.tenant_id,
                     'appointment_confirmation',
                     'Confirmação de Agendamento',
                     'appointment.created',
                     'whatsapp',
                     true,
                     'Olá {customer_name} 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nPara reagendar ou cancelar, acesse o link abaixo:\n{management_link}\n\nObrigado!'
                 ) 
                 ON CONFLICT (tenant_id, key) DO UPDATE SET key = EXCLUDED.key
                 RETURNING id INTO v_automation_id;
             END IF;

             -- 3. Verificar duplicidade na fila
             SELECT EXISTS (
                 SELECT 1 FROM public.automation_queue
                 WHERE appointment_id = NEW.id
                 AND (automation_type = 'new_appointment' OR workflow_key = 'appointment_confirmation')
                 AND status IN ('pending', 'success', 'sent')
             ) INTO v_exists;

             IF NOT v_exists THEN
                 -- 4. Inserir na fila
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

                 -- 5. Registro de debug em logs
                 INSERT INTO public.automation_logs (
                     tenant_id,
                     automation_id,
                     appointment_id,
                     customer_id,
                     status,
                     error_message,
                     payload
                 ) VALUES (
                     NEW.tenant_id,
                     v_automation_id,
                     NEW.id,
                     NEW.customer_id,
                     'debug',
                     'Queue created automatically by trigger',
                     jsonb_build_object('trigger', 'fn_on_appointment_created_enqueue_automation', 'automation_id', v_automation_id)
                 );
             END IF;
         END IF;
     EXCEPTION WHEN OTHERS THEN
         RAISE WARNING 'Error in fn_on_appointment_created_enqueue_automation: %', SQLERRM;
     END;
     RETURN NEW;
 END;
 $function$;
