-- 1. Create cashback_transactions if not exists
CREATE TABLE IF NOT EXISTS public.cashback_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'cashback_earned', 'cashback_used', 'cashback_reversed'
    amount DECIMAL(10, 2) NOT NULL,
    base_amount DECIMAL(10, 2), -- The total price that generated this cashback
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_transactions TO authenticated;
GRANT ALL ON public.cashback_transactions TO service_role;
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their tenant''s cashback transactions') THEN
        CREATE POLICY "Users can view their tenant's cashback transactions" ON public.cashback_transactions FOR SELECT USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 2. Ensure customer balance columns exist (they should, but just in case)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='credits') THEN
        ALTER TABLE public.customers ADD COLUMN credits DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='cashback_balance') THEN
        ALTER TABLE public.customers ADD COLUMN cashback_balance DECIMAL(10, 2) DEFAULT 0;
    END IF;
END $$;

-- 3. Redefine complete_appointment RPC
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id UUID,
    p_changed_by_type TEXT DEFAULT 'admin',
    p_changed_by_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_cashback_percentage DECIMAL(10, 2) := 0;
    v_cashback_amount DECIMAL(10, 2) := 0;
    v_already_earned BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- 1. Get appointment and tenant config
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já está concluído');
    END IF;

    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;

    -- 2. Update status to completed
    v_result := update_appointment_status(
        p_appointment_id,
        'completed',
        p_changed_by_type,
        p_changed_by_id,
        p_source
    );

    IF NOT (v_result->>'success')::boolean THEN
        RETURN v_result;
    END IF;

    -- 3. Cashback Logic
    -- Check if already earned for this appointment
    SELECT EXISTS (
        SELECT 1 FROM cashback_transactions 
        WHERE appointment_id = p_appointment_id AND type = 'cashback_earned'
    ) INTO v_already_earned;

    IF NOT v_already_earned AND v_appt.payment_status = 'paid' THEN
        -- Assuming profiles has a cashback_percentage column or similar. 
        -- If not explicitly found, we use a default or look for settings.
        -- Based on user request "a cada R$ 100,00 gastos, cliente ganha R$ 10,00" -> 10%
        v_cashback_percentage := COALESCE((v_tenant.settings->>'cashback_percentage')::decimal, 10); 
        
        v_cashback_amount := (v_appt.total_price * v_cashback_percentage) / 100;

        IF v_cashback_amount > 0 THEN
            -- Update customer balance
            UPDATE customers 
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount
            WHERE id = v_appt.customer_id;

            -- Record transaction
            INSERT INTO cashback_transactions (
                tenant_id, customer_id, appointment_id, type, amount, base_amount, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_amount, v_appt.total_price, 'Cashback por atendimento concluído'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_amount,
        'new_status', 'completed'
    );
END;
$$;

-- 4. Update update_appointment_status to be safer and avoid recursion if called from other RPCs
-- (Already looks good in the previous migration, but we ensure it works well with the new ones)

-- 5. Fix cancel_appointment to ensure it is robust (already pretty good but verifying logic)
-- We add a check for cashback reversal if it was already earned (unlikely for scheduled but good for completed -> cancelled transitions if ever allowed)
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
    v_cashback_to_reverse DECIMAL(10, 2) := 0;
BEGIN
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Este agendamento já foi cancelado', 'already_cancelled', true);
    END IF;

    -- Credits Refund Logic
    SELECT EXISTS (
        SELECT 1 FROM credit_transactions 
        WHERE appointment_id = p_appointment_id AND type IN ('credit_refund', 'pix_to_credit')
    ) INTO v_already_refunded;

    IF NOT v_already_refunded THEN
        v_credits_to_refund := COALESCE(v_appt.credit_used, 0);
        
        IF (v_appt.payment_method = 'pix' OR v_appt.payment_method = 'PIX') AND v_appt.payment_status = 'paid' THEN
            v_pix_to_refund := COALESCE(v_appt.amount_paid, v_appt.final_amount, v_appt.total_price, 0);
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

    -- Cashback Reversal if was completed
    IF v_appt.status = 'completed' THEN
        SELECT SUM(amount) INTO v_cashback_to_reverse FROM cashback_transactions 
        WHERE appointment_id = p_appointment_id AND type = 'cashback_earned';
        
        IF v_cashback_to_reverse > 0 THEN
             UPDATE customers 
             SET cashback_balance = GREATEST(0, COALESCE(cashback_balance, 0) - v_cashback_to_reverse)
             WHERE id = v_appt.customer_id;

             INSERT INTO cashback_transactions (
                tenant_id, customer_id, appointment_id, type, amount, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_reversed', -v_cashback_to_reverse, 'Estorno de cashback por cancelamento'
            );
        END IF;
    END IF;

    -- Update status
    UPDATE appointments 
    SET 
        status = 'cancelled',
        updated_at = now(),
        cancelled_at = now(),
        cancel_source = p_source,
        cancelled_by = p_cancelled_by,
        refund_preference = p_refund_preference
    WHERE id = p_appointment_id;

    -- Log status change
    INSERT INTO appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_appt.status, 'cancelled', p_cancelled_by, p_changed_by_id, p_source, 
        jsonb_build_object('refund_preference', p_refund_preference, 'credits_refunded', v_credits_to_refund)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'credits_refunded', v_credits_to_refund, 
        'pix_refund_amount', v_pix_to_refund,
        'cashback_reversed', v_cashback_to_reverse
    );
END;
$$;
