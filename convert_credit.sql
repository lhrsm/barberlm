                                                               pg_get_functiondef                                                               
------------------------------------------------------------------------------------------------------------------------------------------------
 CREATE OR REPLACE FUNCTION public.convert_appointment_to_credit(p_appointment_id uuid, p_customer_id uuid, p_tenant_id uuid, p_amount numeric)+
  RETURNS jsonb                                                                                                                                +
  LANGUAGE plpgsql                                                                                                                             +
  SECURITY DEFINER                                                                                                                             +
  SET search_path TO 'public'                                                                                                                  +
 AS $function$                                                                                                                                 +
 DECLARE                                                                                                                                       +
     v_appointment RECORD;                                                                                                                     +
     v_credit_id UUID;                                                                                                                         +
 BEGIN                                                                                                                                         +
     -- Select with row-level lock                                                                                                             +
     SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id FOR UPDATE;                                                     +
                                                                                                                                               +
     IF NOT FOUND THEN                                                                                                                         +
         RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');                                                   +
     END IF;                                                                                                                                   +
                                                                                                                                               +
     IF v_appointment.status = 'cancelled' THEN                                                                                                +
         RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');                                                +
     END IF;                                                                                                                                   +
                                                                                                                                               +
     -- Extra safety: check if this specific appointment has already been converted                                                            +
     IF v_appointment.refund_status = 'converted_to_credit' THEN                                                                               +
          RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi convertido em crédito');                               +
     END IF;                                                                                                                                   +
                                                                                                                                               +
     -- Double check in customer_credits table by appointment_id                                                                               +
     IF EXISTS (SELECT 1 FROM customer_credits WHERE appointment_id = p_appointment_id) THEN                                                   +
         RETURN jsonb_build_object('success', false, 'error', 'Crédito já gerado para este agendamento');                                      +
     END IF;                                                                                                                                   +
                                                                                                                                               +
     -- 1. Create the credit record                                                                                                            +
     INSERT INTO customer_credits (                                                                                                            +
         tenant_id,                                                                                                                            +
         customer_id,                                                                                                                          +
         appointment_id,                                                                                                                       +
         payment_id,                                                                                                                           +
         amount,                                                                                                                               +
         status                                                                                                                                +
     ) VALUES (                                                                                                                                +
         p_tenant_id,                                                                                                                          +
         p_customer_id,                                                                                                                        +
         p_appointment_id,                                                                                                                     +
         v_appointment.payment_id,                                                                                                             +
         p_amount,                                                                                                                             +
         'available'                                                                                                                           +
     ) RETURNING id INTO v_credit_id;                                                                                                          +
                                                                                                                                               +
     -- 2. Update the appointment status and source                                                                                            +
     UPDATE appointments                                                                                                                       +
     SET                                                                                                                                       +
         status = 'cancelled',                                                                                                                 +
         cancelled_at = now(),                                                                                                                 +
         cancel_source = 'customer_credit_conversion',                                                                                         +
         refund_status = 'converted_to_credit',                                                                                                +
         updated_at = now()                                                                                                                    +
     WHERE id = p_appointment_id;                                                                                                              +
                                                                                                                                               +
     -- 3. Update the global credit balance on customer record                                                                                 +
     UPDATE customers                                                                                                                          +
     SET                                                                                                                                       +
         credits = COALESCE(credits, 0) + p_amount,                                                                                            +
         updated_at = now()                                                                                                                    +
     WHERE id = p_customer_id;                                                                                                                 +
                                                                                                                                               +
     -- 4. Log status change                                                                                                                   +
     INSERT INTO appointment_status_logs (                                                                                                     +
         appointment_id,                                                                                                                       +
         old_status,                                                                                                                           +
         new_status,                                                                                                                           +
         changed_by_type,                                                                                                                      +
         source,                                                                                                                               +
         metadata                                                                                                                              +
     ) VALUES (                                                                                                                                +
         p_appointment_id,                                                                                                                     +
         v_appointment.status,                                                                                                                 +
         'cancelled',                                                                                                                          +
         'customer',                                                                                                                           +
         'public_link',                                                                                                                        +
         jsonb_build_object(                                                                                                                   +
             'action', 'convert_to_credit',                                                                                                    +
             'amount', p_amount,                                                                                                               +
             'credit_id', v_credit_id,                                                                                                         +
             'payment_id', v_appointment.payment_id                                                                                            +
         )                                                                                                                                     +
     );                                                                                                                                        +
                                                                                                                                               +
     RETURN jsonb_build_object('success', true, 'credit_id', v_credit_id);                                                                     +
 EXCEPTION WHEN OTHERS THEN                                                                                                                    +
     RETURN jsonb_build_object('success', false, 'error', SQLERRM);                                                                            +
 END;                                                                                                                                          +
 $function$                                                                                                                                    +
 
(1 row)

