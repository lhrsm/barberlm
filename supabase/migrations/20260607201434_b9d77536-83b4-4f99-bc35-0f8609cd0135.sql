CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id uuid,
  p_cancelled_by text,
  p_source text DEFAULT 'admin'::text,
  p_refund_preference text DEFAULT 'none'::text,
  p_changed_by_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_appointment record;
  v_group_id uuid;
  v_all_cancelled boolean;
BEGIN
  -- 1. Fetch appointment details
  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  -- 2. Prevent cancelling completed or already cancelled appointments
  IF v_appointment.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível cancelar um agendamento já concluído');
  END IF;

  IF v_appointment.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já está cancelado');
  END IF;

  -- 3. Update appointment status
  UPDATE public.appointments 
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_cancelled_by,
    cancel_source = p_source,
    refund_preference = p_refund_preference,
    customer_action_source = CASE WHEN p_cancelled_by = 'customer' THEN p_source ELSE customer_action_source END
  WHERE id = p_appointment_id;

  -- 4. Log status change
  INSERT INTO public.appointment_status_logs (
    appointment_id,
    old_status,
    new_status,
    changed_by_type,
    changed_by_id,
    source,
    metadata
  ) VALUES (
    p_appointment_id,
    v_appointment.status,
    'cancelled',
    p_cancelled_by,
    p_changed_by_id,
    p_source,
    jsonb_build_object('refund_preference', p_refund_preference)
  );

  -- 5. Handle appointment groups if applicable
  v_group_id := v_appointment.appointment_group_id;
  IF v_group_id IS NOT NULL THEN
    -- Check if all other appointments in the group are cancelled
    SELECT NOT EXISTS (
      SELECT 1 FROM public.appointments 
      WHERE appointment_group_id = v_group_id 
      AND status != 'cancelled'
    ) INTO v_all_cancelled;

    IF v_all_cancelled THEN
      UPDATE public.appointment_groups 
      SET status = 'cancelled', updated_at = now()
      WHERE id = v_group_id;
    END IF;
  END IF;

  -- 6. Launch financial adjustment log if paid
  IF v_appointment.payment_status = 'paid' AND v_appointment.total_price > 0 THEN
    INSERT INTO public.financial_adjustment_logs (
      appointment_id,
      tenant_id,
      old_values,
      new_values,
      reason,
      adjusted_at,
      adjusted_by
    ) VALUES (
      p_appointment_id,
      v_appointment.tenant_id,
      jsonb_build_object('amount', v_appointment.total_price, 'payment_status', 'paid'),
      jsonb_build_object('amount', v_appointment.total_price, 'payment_status', 'cancelled_refund_pending'),
      'Cancelamento de agendamento pago: ' || p_refund_preference,
      now(),
      p_changed_by_id
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_start_time timestamp with time zone,
  p_new_end_time timestamp with time zone,
  p_changed_by_type text DEFAULT 'admin'::text,
  p_changed_by_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'system'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_appointment record;
  v_old_start timestamp with time zone;
  v_old_end timestamp with time zone;
BEGIN
  -- 1. Fetch current appointment
  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  -- 2. Validations
  IF v_appointment.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento cancelado');
  END IF;

  IF v_appointment.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento já concluído');
  END IF;

  v_old_start := v_appointment.start_time;
  v_old_end := v_appointment.end_time;

  -- 3. Update appointment
  UPDATE public.appointments 
  SET 
    start_time = p_new_start_time,
    end_time = p_new_end_time,
    updated_at = now(),
    updated_by_type = p_changed_by_type,
    updated_by_id = p_changed_by_id,
    customer_action_source = CASE WHEN p_changed_by_type = 'customer' THEN p_source ELSE customer_action_source END
  WHERE id = p_appointment_id;

  -- 4. Log change
  INSERT INTO public.appointment_status_logs (
    appointment_id,
    old_status,
    new_status,
    changed_by_type,
    changed_by_id,
    source,
    metadata
  ) VALUES (
    p_appointment_id,
    v_appointment.status,
    v_appointment.status, -- status remains the same
    p_changed_by_type,
    p_changed_by_id,
    p_source,
    p_metadata || jsonb_build_object(
      'action', 'reschedule',
      'old_start', v_old_start,
      'new_start', p_new_start_time,
      'old_end', v_old_end,
      'new_end', p_new_end_time
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;
