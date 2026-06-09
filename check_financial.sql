                                                        pg_get_functiondef                                                        
----------------------------------------------------------------------------------------------------------------------------------
 CREATE OR REPLACE FUNCTION public.check_appointment_financial_status(p_appointment_id uuid)                                     +
  RETURNS jsonb                                                                                                                  +
  LANGUAGE plpgsql                                                                                                               +
  SECURITY DEFINER                                                                                                               +
 AS $function$                                                                                                                   +
 DECLARE                                                                                                                         +
     v_appt RECORD;                                                                                                              +
     v_pix_paid BOOLEAN;                                                                                                         +
     v_pix_amount NUMERIC(10,2);                                                                                                 +
     v_credits_used NUMERIC(10,2);                                                                                               +
     v_cashback_used NUMERIC(10,2);                                                                                              +
 BEGIN                                                                                                                           +
     SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;                                                  +
                                                                                                                                 +
     IF NOT FOUND THEN                                                                                                           +
         RETURN jsonb_build_object('error', 'Agendamento não encontrado');                                                       +
     END IF;                                                                                                                     +
                                                                                                                                 +
     v_credits_used := COALESCE(v_appt.credits_used, 0);                                                                         +
     v_cashback_used := COALESCE(v_appt.cashback_used, 0);                                                                       +
                                                                                                                                 +
     -- Calculate Pix amount                                                                                                     +
     IF v_appt.pix_amount IS NOT NULL AND v_appt.pix_amount > 0 THEN                                                             +
         v_pix_amount := v_appt.pix_amount;                                                                                      +
     ELSE                                                                                                                        +
         v_pix_amount := GREATEST(0, COALESCE(v_appt.total_price, 0) - v_credits_used - v_cashback_used);                        +
     END IF;                                                                                                                     +
                                                                                                                                 +
     -- Check if it was paid via Pix                                                                                             +
     v_pix_paid := (v_appt.payment_status = 'paid' OR v_appt.payment_status = 'confirmed' OR v_appt.payment_status = 'completed')+
                   AND (COALESCE(v_appt.payment_method, '') ~* 'pix' OR v_pix_amount > 0);                                       +
                                                                                                                                 +
     RETURN jsonb_build_object(                                                                                                  +
         'has_paid_pix', v_pix_paid,                                                                                             +
         'paid_pix_amount', CASE WHEN v_pix_paid THEN v_pix_amount ELSE 0 END,                                                   +
         'has_used_credits', v_credits_used > 0,                                                                                 +
         'used_credit_amount', v_credits_used,                                                                                   +
         'has_used_cashback', v_cashback_used > 0,                                                                               +
         'used_cashback_amount', v_cashback_used,                                                                                +
         'payment_id', v_appt.payment_id,                                                                                        +
         'requires_financial_decision', v_pix_paid OR v_credits_used > 0 OR v_cashback_used > 0,                                 +
         'status', v_appt.status,                                                                                                +
         'payment_status', v_appt.payment_status                                                                                 +
     );                                                                                                                          +
 END;                                                                                                                            +
 $function$                                                                                                                      +
 
(1 row)

