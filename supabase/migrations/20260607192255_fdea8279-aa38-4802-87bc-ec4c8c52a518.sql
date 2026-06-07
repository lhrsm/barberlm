CREATE OR REPLACE FUNCTION public.reschedule_appointment(
    p_appointment_id UUID,
    p_new_start_time TIMESTAMP WITH TIME ZONE,
    p_new_end_time TIMESTAMP WITH TIME ZONE,
    p_changed_by_type TEXT,
    p_changed_by_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT 'system',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_appointment RECORD;
    v_old_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Buscar agendamento
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- 2. Validar restrições
    IF v_appointment.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento cancelado');
    END IF;

    IF v_appointment.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento já finalizado');
    END IF;

    v_old_start_time := v_appointment.start_time;

    -- 3. Atualizar agendamento
    UPDATE appointments 
    SET 
        start_time = p_new_start_time,
        end_time = p_new_end_time,
        updated_at = now(),
        -- Resetar flags de notificação para reenviar lembretes se necessário
        reminder_sent = false,
        reminder_sent_at = NULL,
        confirmation_sent = false,
        confirmation_sent_at = NULL
    WHERE id = p_appointment_id;

    -- 4. Registrar no histórico
    INSERT INTO appointment_status_logs (
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
        v_appointment.status, -- Mantém o mesmo status, mas registra a alteração temporal no metadata
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata || jsonb_build_object(
            'action', 'reschedule',
            'old_start_time', v_old_start_time,
            'new_start_time', p_new_start_time
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'old_start_time', v_old_start_time, 
        'new_start_time', p_new_start_time
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, UUID, TEXT, JSONB) TO anon, authenticated, service_role;