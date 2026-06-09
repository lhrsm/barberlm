-- Update request_appointment_refund RPC for consistency
CREATE OR REPLACE FUNCTION public.request_appointment_refund(p_appointment_id uuid, p_customer_id uuid, p_tenant_id uuid, p_amount numeric, p_pix_key text, p_pix_key_type text, p_account_holder_name text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
 DECLARE
     v_existing_refund_id UUID;
     v_existing_credit_id UUID;
     v_refund_id UUID;
 BEGIN
     -- 1. Check if refund already exists for this appointment (not rejected/cancelled)
     SELECT id INTO v_existing_refund_id
     FROM public.refund_requests
     WHERE appointment_id = p_appointment_id
     AND status NOT IN ('rejected', 'cancelled');

     IF v_existing_refund_id IS NOT NULL THEN
         RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de estorno ativa para este agendamento.');
     END IF;

     -- 2. Check if credit already exists for this appointment
     SELECT id INTO v_existing_credit_id
     FROM public.customer_credits
     WHERE appointment_id = p_appointment_id
     AND status != 'cancelled';

     IF v_existing_credit_id IS NOT NULL THEN
         RETURN jsonb_build_object('success', false, 'error', 'O valor deste agendamento já foi convertido em crédito.');
     END IF;

     -- 3. Update appointment status
     UPDATE public.appointments
     SET 
         status = 'cancelled',
         cancelled_at = now(),
         customer_action_source = 'link_publico',
         refund_status = 'refund_requested',
         refund_type = 'refund'
     WHERE id = p_appointment_id;

     -- 4. Create refund request
     INSERT INTO public.refund_requests (
         tenant_id,
         appointment_id,
         customer_id,
         amount,
         pix_key,
         pix_type,
         holder_name,
         notes,
         status,
         created_at
     ) VALUES (
         p_tenant_id,
         p_appointment_id,
         p_customer_id,
         p_amount,
         p_pix_key,
         p_pix_key_type,
         p_account_holder_name,
         p_notes,
         'requested',
         now()
     ) RETURNING id INTO v_refund_id;

     RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
 END;
$function$;
