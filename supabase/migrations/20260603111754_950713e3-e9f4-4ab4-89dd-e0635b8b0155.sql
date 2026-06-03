-- Adiciona coluna de agrupamento de agendamentos
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_group_id UUID;

-- Cria tabela de logs de status de agendamentos
CREATE TABLE IF NOT EXISTS public.appointment_status_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_type TEXT NOT NULL, -- 'admin', 'barber', 'customer', 'system', 'automation'
    changed_by_id UUID, -- UUID do perfil ou usuário que mudou
    source TEXT NOT NULL, -- 'admin_panel', 'barber_panel', 'customer_portal', 'calendar', 'automation', 'whatsapp', 'system'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissões para appointment_status_logs
GRANT SELECT, INSERT ON public.appointment_status_logs TO authenticated;
GRANT ALL ON public.appointment_status_logs TO service_role;

-- RLS para appointment_status_logs
ALTER TABLE public.appointment_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of their own appointments"
ON public.appointment_status_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = appointment_status_logs.appointment_id
        AND (a.tenant_id = auth.uid() OR a.customer_id = auth.uid())
    )
);

CREATE POLICY "Authenticated users can insert logs"
ON public.appointment_status_logs
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Função centralizada para atualizar status de agendamento
CREATE OR REPLACE FUNCTION public.update_appointment_status(
    p_appointment_id UUID,
    p_new_status TEXT,
    p_changed_by_type TEXT,
    p_changed_by_id UUID,
    p_source TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
    v_old_status TEXT;
    v_tenant_id UUID;
    v_appointment_group_id UUID;
BEGIN
    -- Busca status atual e tenant_id
    SELECT status, tenant_id, appointment_group_id INTO v_old_status, v_tenant_id, v_appointment_group_id
    FROM public.appointments
    WHERE id = p_appointment_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    -- Atualiza o agendamento
    UPDATE public.appointments
    SET 
        status = p_new_status,
        updated_at = now(),
        confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END,
        cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN now() ELSE cancelled_at END
    WHERE id = p_appointment_id;

    -- Registra o log
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
        v_old_status,
        p_new_status,
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata
    );

    -- Dispara evento para o motor de automação se necessário
    -- (Aqui poderíamos inserir na automation_queue se houver workflows para mudança de status)
    INSERT INTO public.automation_events (
        tenant_id,
        event_name,
        entity_id,
        payload
    ) VALUES (
        v_tenant_id,
        'appointment.status_changed',
        p_appointment_id,
        jsonb_build_object(
            'old_status', v_old_status,
            'new_status', p_new_status,
            'source', p_source,
            'group_id', v_appointment_group_id
        )
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_appointment_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_appointment_status TO service_role;
