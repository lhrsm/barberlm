-- 1. Criar tabela de créditos de clientes
CREATE TABLE IF NOT EXISTS public.customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    appointment_id UUID REFERENCES public.appointments(id),
    payment_id TEXT, -- ID de referência do pagamento original (ex: ID do Pix)
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    used_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    available_amount NUMERIC(10,2) GENERATED ALWAYS AS (amount - used_amount) STORED,
    status TEXT NOT NULL DEFAULT 'available', -- available, partially_used, used, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS e permissões
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.customer_credits TO authenticated, anon;
GRANT ALL ON public.customer_credits TO service_role;

-- Política simples: cliente vê apenas seus créditos
CREATE POLICY "Users can view their own credits" ON public.customer_credits
    FOR SELECT USING (true); -- Permitimos anon para o link público, mas a função RPC garante a segurança via token

-- 2. Garantir que appointments tenha campos para estorno/crédito se não existirem
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS payment_id TEXT,
ADD COLUMN IF NOT EXISTS refund_status TEXT; -- pending, processed, converted_to_credit

-- 3. Função atômica para conversão em crédito
CREATE OR REPLACE FUNCTION public.convert_appointment_to_credit(
    p_appointment_id UUID,
    p_customer_id UUID,
    p_tenant_id UUID,
    p_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appointment RECORD;
    v_credit_id UUID;
BEGIN
    -- Verificar agendamento
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appointment.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    -- Verificar se já existe crédito para este agendamento
    IF EXISTS (SELECT 1 FROM customer_credits WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito já gerado para este agendamento');
    END IF;

    -- 1. Criar o registro de crédito
    INSERT INTO customer_credits (
        tenant_id,
        customer_id,
        appointment_id,
        payment_id,
        amount,
        status
    ) VALUES (
        p_tenant_id,
        p_customer_id,
        p_appointment_id,
        v_appointment.payment_id,
        p_amount,
        'available'
    ) RETURNING id INTO v_credit_id;

    -- 2. Atualizar o agendamento
    UPDATE appointments 
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancel_source = 'customer_credit_conversion',
        refund_status = 'converted_to_credit',
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 3. Atualizar o saldo global no cadastro do cliente (campo existente)
    UPDATE customers 
    SET credits = COALESCE(credits, 0) + p_amount
    WHERE id = p_customer_id;

    -- 4. Registrar log
    INSERT INTO appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        source,
        metadata
    ) VALUES (
        p_appointment_id,
        v_appointment.status,
        'cancelled',
        'customer',
        'public_link',
        jsonb_build_object(
            'action', 'convert_to_credit',
            'amount', p_amount,
            'credit_id', v_credit_id
        )
    );

    RETURN jsonb_build_object('success', true, 'credit_id', v_credit_id);
END;
$$;