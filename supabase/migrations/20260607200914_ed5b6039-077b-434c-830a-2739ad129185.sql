DROP FUNCTION IF EXISTS public.get_appointment_group_by_token(TEXT);

CREATE OR REPLACE FUNCTION public.get_appointment_group_by_token(p_token TEXT)
RETURNS TABLE (
    group_id UUID,
    tenant_id UUID,
    customer_id UUID,
    customer_name TEXT,
    business_name TEXT,
    business_phone TEXT,
    total_amount NUMERIC,
    payment_status TEXT,
    group_status TEXT,
    appointment_id UUID,
    service_id UUID,
    service_name TEXT,
    professional_id UUID,
    professional_name TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    appointment_status TEXT,
    service_amount NUMERIC,
    group_sequence INTEGER,
    management_token TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ag.id as group_id,
        ag.tenant_id,
        ag.customer_id,
        c.name as customer_name,
        p.business_name,
        p.phone as business_phone,
        ag.total_amount,
        ag.payment_status,
        ag.status as group_status,
        a.id as appointment_id,
        a.service_id,
        s.name as service_name,
        a.barber_id as professional_id,
        b.name as professional_name,
        a.start_time,
        a.end_time,
        a.status as appointment_status,
        a.service_amount,
        a.group_sequence,
        a.management_token
    FROM public.appointment_groups ag
    JOIN public.appointments a ON a.appointment_group_id = ag.id
    LEFT JOIN public.customers c ON ag.customer_id = c.id
    LEFT JOIN public.profiles p ON ag.tenant_id = p.id
    LEFT JOIN public.services s ON a.service_id = s.id
    LEFT JOIN public.barbers b ON a.barber_id = b.id
    WHERE ag.group_token = p_token
    ORDER BY a.group_sequence ASC;
END;
$$;
