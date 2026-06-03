-- 1. Add missing columns to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- 2. Add updated_at to barbers and customers for consistency
ALTER TABLE public.barbers 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 3. Create or replace update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Add triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_appointments_updated_at') THEN
        CREATE TRIGGER update_appointments_updated_at
        BEFORE UPDATE ON public.appointments
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_barbers_updated_at') THEN
        CREATE TRIGGER update_barbers_updated_at
        BEFORE UPDATE ON public.barbers
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_customers_updated_at') THEN
        CREATE TRIGGER update_customers_updated_at
        BEFORE UPDATE ON public.customers
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- 5. Fix the RPC function
CREATE OR REPLACE FUNCTION public.update_appointment_status(
    p_appointment_id UUID, 
    p_new_status TEXT, 
    p_changed_by_type TEXT, 
    p_changed_by_id UUID DEFAULT NULL, 
    p_source TEXT DEFAULT 'unknown', 
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    -- Note: updated_at is handled by trigger
    UPDATE public.appointments
    SET 
        status = p_new_status,
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

    -- Dispara evento para o motor de automação
    INSERT INTO public.automation_events (
        tenant_id,
        event_name,
        entity_type,
        entity_id,
        payload
    ) VALUES (
        v_tenant_id,
        'appointment.status_changed',
        'appointment',
        p_appointment_id,
        jsonb_build_object(
            'old_status', v_old_status,
            'new_status', p_new_status,
            'source', p_source,
            'group_id', v_appointment_group_id
        )
    );

END;
$$;

-- 6. Grant execute permissions (already granted to public, but making sure)
GRANT EXECUTE ON FUNCTION public.update_appointment_status TO anon, authenticated, service_role;
