CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid, 
    p_changed_by_type text DEFAULT 'admin'::text, 
    p_changed_by_id uuid DEFAULT NULL::uuid, 
    p_source text DEFAULT 'system'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_cashback_percentage DECIMAL(10, 2) := 0;
    v_cashback_amount DECIMAL(10, 2) := 0;
    v_already_earned BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- 1. Buscar agendamento e configurações do tenant (perfil)
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já está concluído');
    END IF;

    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;

    -- 2. Lógica de Cashback (Calculada antes para logar no status)
    IF COALESCE(v_tenant.cashback_enabled, false) AND COALESCE(v_appt.payment_status, 'pending') = 'paid' THEN
        SELECT EXISTS (
            SELECT 1 FROM cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'cashback_earned'
        ) INTO v_already_earned;

        IF NOT v_already_earned THEN
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
            IF v_cashback_percentage > 0 THEN
                v_cashback_amount := (v_appt.total_price * v_cashback_percentage) / 100;
            END IF;
        END IF;
    END IF;

    -- 3. Atualizar status para concluído usando função central
    v_result := update_appointment_status(
        p_appointment_id, 
        'completed', 
        p_changed_by_type, 
        p_changed_by_id, 
        p_source,
        jsonb_build_object(
            'cashback_earned', v_cashback_amount,
            'cashback_percentage', v_cashback_percentage,
            'total_price', v_appt.total_price
        )
    );

    IF NOT (v_result->>'success')::boolean THEN
        RETURN v_result;
    END IF;

    -- 4. Efetivar cashback se calculado
    IF v_cashback_amount > 0 AND NOT v_already_earned THEN
        UPDATE customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount
        WHERE id = v_appt.customer_id;

        INSERT INTO cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_amount, v_appt.total_price, 'Cashback por atendimento concluído'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_amount,
        'new_status', 'completed'
    );
END;
$$;
