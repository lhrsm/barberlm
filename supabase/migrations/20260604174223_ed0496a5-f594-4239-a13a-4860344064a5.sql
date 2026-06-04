CREATE OR REPLACE FUNCTION public.handle_appointment_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_template_id UUID;
  v_template TEXT;
  v_active BOOLEAN;
  v_customer_name TEXT;
  v_barbershop_name TEXT;
  v_service_name TEXT;
  v_professional_name TEXT;
  v_appointment_date TEXT;
  v_appointment_time TEXT;
  v_idempotency_key TEXT;
BEGIN
  -- Get template details and active status
  SELECT id, template, active 
  INTO v_template_id, v_template, v_active
  FROM public.automation_templates
  WHERE tenant_id = NEW.tenant_id 
    AND key = 'appointment_confirmation'
  LIMIT 1;

  -- ONLY proceed if template exists AND is active
  IF v_template_id IS NOT NULL AND v_active = TRUE THEN
    -- Generate idempotency key
    v_idempotency_key := 'apt_conf_' || NEW.id;

    -- Get data for template replacement
    SELECT name INTO v_customer_name FROM public.customers WHERE id = NEW.customer_id;
    SELECT name INTO v_barbershop_name FROM public.tenants WHERE id = NEW.tenant_id;
    SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
    
    -- Robust professional name resolution
    SELECT name INTO v_professional_name FROM public.barbers WHERE id = NEW.barber_id;
    IF v_professional_name IS NULL OR v_professional_name = '' THEN
       SELECT full_name INTO v_professional_name FROM public.profiles WHERE id = NEW.barber_id;
    END IF;
    
    -- Timezone handling: America/Sao_Paulo
    v_appointment_date := to_char(NEW.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
    v_appointment_time := to_char(NEW.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');

    -- Insert into queue
    INSERT INTO public.automation_queue (
      tenant_id,
      automation_id,
      appointment_id,
      customer_id,
      payload,
      idempotency_key
    ) VALUES (
      NEW.tenant_id,
      v_template_id,
      NEW.id,
      NEW.customer_id,
      jsonb_build_object(
        'customer_name', COALESCE(v_customer_name, 'Cliente'),
        'barbershop_name', COALESCE(v_barbershop_name, 'Nossa Barbearia'),
        'service_name', COALESCE(v_service_name, 'Serviço'),
        'professional_name', COALESCE(v_professional_name, 'Profissional'),
        'appointment_date', v_appointment_date,
        'appointment_time', v_appointment_time,
        'rendered', v_template
      ),
      v_idempotency_key
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;