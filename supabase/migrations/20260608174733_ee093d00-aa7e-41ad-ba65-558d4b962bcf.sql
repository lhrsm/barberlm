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
         IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN

             -- Buscar ID da automação (template) correspondente
             SELECT id INTO v_automation_id
             FROM public.automation_templates
             WHERE tenant_id = NEW.tenant_id AND key = 'appointment_confirmation'
             LIMIT 1;

             -- Se não existir automação configurada, buscar ou criar
             IF v_automation_id IS NULL THEN
                 v_automation_id := public.get_or_create_automation(NEW.tenant_id, 'appointment_confirmation');
             END IF;

             -- Verificar duplicidade na fila
             SELECT EXISTS (
                 SELECT 1 FROM public.automation_queue
                 WHERE appointment_id = NEW.id
                 AND (automation_type = 'new_appointment' OR workflow_key = 'appointment_confirmation')
                 AND status IN ('pending', 'success', 'sent')
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

                 -- Log de sucesso no enfileiramento
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
                     jsonb_build_object('trigger', 'fn_on_appointment_created_enqueue_automation')
                 );
             END IF;
         END IF;
     EXCEPTION WHEN OTHERS THEN
         -- Log error silently but don't block
         RAISE WARNING 'Error in fn_on_appointment_created_enqueue_automation: %', SQLERRM;
     END;
     RETURN NEW;
 END;
 $function$;
