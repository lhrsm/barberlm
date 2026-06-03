-- 1. Create credit_transactions if not exists
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'debit_booking', 'credit_refund', 'pix_to_credit', 'manual_adjustment'
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their tenant''s credit transactions') THEN
        CREATE POLICY "Users can view their tenant's credit transactions" ON public.credit_transactions FOR SELECT USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 2. Create refund_requests if not exists
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'rejected'
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their tenant''s refund requests') THEN
        CREATE POLICY "Users can view their tenant's refund requests" ON public.refund_requests FOR SELECT USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 3. Create appointment_status_logs if not exists
CREATE TABLE IF NOT EXISTS public.appointment_status_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_type TEXT NOT NULL, -- 'customer', 'admin', 'barber', 'automation'
    changed_by_id UUID,
    source TEXT NOT NULL, -- 'whatsapp', 'customer_portal', 'admin_panel', 'barber_panel', 'calendar'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_status_logs TO authenticated;
GRANT ALL ON public.appointment_status_logs TO service_role;
ALTER TABLE public.appointment_status_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their tenant''s status logs') THEN
        CREATE POLICY "Users can view their tenant's status logs" ON public.appointment_status_logs FOR SELECT USING (appointment_id IN (SELECT id FROM appointments WHERE tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));
    END IF;
END $$;

-- 4. Redefine Status Update RPC
DROP FUNCTION IF EXISTS public.update_appointment_status(uuid,text,text,uuid,text,jsonb);

CREATE OR REPLACE FUNCTION public.update_appointment_status(
    p_appointment_id UUID,
    p_new_status TEXT,
    p_changed_by_type TEXT,
    p_changed_by_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT 'system',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_status TEXT;
    v_appointment RECORD;
BEGIN
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
    END IF;

    v_old_status := v_appointment.status;

    UPDATE appointments 
    SET 
        status = p_new_status,
        updated_at = now(),
        confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END,
        cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN now() ELSE cancelled_at END
    WHERE id = p_appointment_id;

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
        v_old_status,
        p_new_status,
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata
    );

    RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$;

-- 5. Complex Cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id UUID,
    p_cancelled_by TEXT,
    p_source TEXT,
    p_refund_preference TEXT DEFAULT 'none',
    p_changed_by_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appt RECORD;
    v_credits_to_refund DECIMAL(10, 2) := 0;
    v_pix_to_refund DECIMAL(10, 2) := 0;
    v_already_refunded BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi cancelado', 'already_cancelled', true);
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamentos concluídos não podem ser cancelados');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM credit_transactions 
        WHERE appointment_id = p_appointment_id AND type IN ('credit_refund', 'pix_to_credit')
    ) INTO v_already_refunded;

    IF NOT v_already_refunded THEN
        v_credits_to_refund := COALESCE(v_appt.credit_used, 0);
        
        IF (v_appt.payment_method = 'pix' OR v_appt.payment_method = 'PIX') AND v_appt.payment_status = 'paid' THEN
            v_pix_to_refund := COALESCE(v_appt.amount_paid, v_appt.final_amount, 0);
        END IF;

        IF v_credits_to_refund > 0 THEN
            UPDATE customers 
            SET credits = COALESCE(credits, 0) + v_credits_to_refund
            WHERE id = v_appt.customer_id;

            INSERT INTO credit_transactions (
                tenant_id, customer_id, appointment_id, type, amount, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'credit_refund', v_credits_to_refund, 'Estorno de créditos por cancelamento'
            );
        END IF;

        IF v_pix_to_refund > 0 THEN
            IF p_refund_preference = 'credit' THEN
                UPDATE customers 
                SET credits = COALESCE(credits, 0) + v_pix_to_refund
                WHERE id = v_appt.customer_id;

                INSERT INTO credit_transactions (
                    tenant_id, customer_id, appointment_id, type, amount, description
                ) VALUES (
                    v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'pix_to_credit', v_pix_to_refund, 'Conversão de pagamento PIX em créditos por cancelamento'
                );
            ELSIF p_refund_preference = 'refund' THEN
                INSERT INTO refund_requests (
                    tenant_id, customer_id, appointment_id, amount, payment_method, status, notes
                ) VALUES (
                    v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_pix_to_refund, 'pix', 'pending', 'Solicitação via ' || p_source
                );
            END IF;
        END IF;
    END IF;

    PERFORM update_appointment_status(
        p_appointment_id,
        'cancelled',
        p_cancelled_by,
        p_changed_by_id,
        p_source,
        jsonb_build_object(
            'refund_preference', p_refund_preference,
            'credits_refunded', v_credits_to_refund,
            'pix_refund_amount', v_pix_to_refund,
            'pix_refund_type', p_refund_preference
        )
    );

    UPDATE appointments 
    SET 
        cancelled_at = now(),
        cancel_source = p_source,
        cancelled_by = p_cancelled_by,
        refund_preference = p_refund_preference
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'credits_refunded', v_credits_to_refund, 
        'pix_refund_amount', v_pix_to_refund,
        'pix_refund_type', p_refund_preference
    );
END;
$$;
