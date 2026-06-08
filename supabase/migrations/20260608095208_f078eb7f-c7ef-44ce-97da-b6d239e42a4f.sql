DROP FUNCTION IF EXISTS get_appointment_by_management_token(text);

CREATE OR REPLACE FUNCTION get_appointment_by_management_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    customer_id UUID,
    status TEXT,
    payment_status TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    total_price NUMERIC,
    final_amount NUMERIC,
    professional_id UUID,
    professional_name TEXT,
    service_id UUID,
    service_name TEXT,
    business_name TEXT,
    business_phone TEXT,
    customer_name TEXT,
    tenant_status TEXT,
    cancel_token TEXT,
    manage_token TEXT,
    appointment_group_id UUID,
    group_token TEXT,
    cancellation_window_hours INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.tenant_id,
        a.customer_id,
        a.status::TEXT,
        a.payment_status::TEXT,
        a.start_time,
        a.end_time,
        a.total_price,
        a.final_amount,
        a.barber_id as professional_id,
        b.name as professional_name,
        a.service_id,
        s.name as service_name,
        p.business_name,
        p.phone as business_phone,
        c.name as customer_name,
        p.status::TEXT as tenant_status,
        a.cancel_token,
        a.manage_token,
        a.appointment_group_id,
        ag.token as group_token,
        p.cancellation_window_hours
    FROM appointments a
    LEFT JOIN barbers b ON a.barber_id = b.id
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN profiles p ON a.tenant_id = p.id
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN appointment_groups ag ON a.appointment_group_id = ag.id
    WHERE a.manage_token = p_token OR a.cancel_token = p_token OR a.id::text = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;