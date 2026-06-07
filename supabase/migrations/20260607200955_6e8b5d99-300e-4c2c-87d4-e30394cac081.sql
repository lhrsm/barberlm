DROP FUNCTION IF EXISTS public.get_appointment_by_management_token(TEXT);

CREATE OR REPLACE FUNCTION public.get_appointment_by_management_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    customer_id UUID,
    customer_name TEXT,
    business_name TEXT,
    business_phone TEXT,
    service_id UUID,
    service_name TEXT,
    professional_id UUID,
    professional_name TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT,
    payment_status TEXT,
    total_price NUMERIC,
    final_amount NUMERIC,
    cancellation_window_hours INTEGER,
    tenant_status TEXT,
    appointment_group_id UUID,
    group_token TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.tenant_id,
        a.customer_id,
        c.name as customer_name,
        p.business_name,
        p.phone as business_phone,
        a.service_id,
        s.name as service_name,
        a.barber_id as professional_id,
        b.name as professional_name,
        a.start_time,
        a.end_time,
        a.status,
        a.payment_status,
        a.total_price,
        a.final_amount,
        p.cancellation_window_hours,
        p.status as tenant_status,
        a.appointment_group_id,
        ag.group_token
    FROM public.appointments a
    LEFT JOIN public.customers c ON a.customer_id = c.id
    LEFT JOIN public.profiles p ON a.tenant_id = p.id
    LEFT JOIN public.services s ON a.service_id = s.id
    LEFT JOIN public.barbers b ON a.barber_id = b.id
    LEFT JOIN public.appointment_groups ag ON a.appointment_group_id = ag.id
    WHERE a.management_token = p_token;
END;
$$;
