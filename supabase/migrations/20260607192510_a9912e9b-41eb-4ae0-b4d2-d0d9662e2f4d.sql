DROP FUNCTION IF EXISTS public.get_appointment_by_management_token(UUID);

CREATE OR REPLACE FUNCTION public.get_appointment_by_management_token(p_token UUID)
RETURNS TABLE (
    id UUID,
    customer_name TEXT,
    service_name TEXT,
    professional_name TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT,
    business_name TEXT,
    business_phone TEXT,
    tenant_id UUID,
    tenant_status TEXT,
    barber_id UUID,
    professional_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        c.name as customer_name,
        s.name as service_name,
        b.name as professional_name,
        a.start_time,
        a.end_time,
        a.status,
        p.business_name,
        p.whatsapp_number as business_phone,
        a.tenant_id,
        p.status as tenant_status,
        a.barber_id,
        a.barber_id as professional_id
    FROM public.appointments a
    JOIN public.customers c ON a.customer_id = c.id
    JOIN public.services s ON a.service_id = s.id
    JOIN public.barbers b ON a.barber_id = b.id
    JOIN public.profiles p ON a.tenant_id = p.id
    WHERE a.management_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_appointment_by_management_token(UUID) TO anon, authenticated;