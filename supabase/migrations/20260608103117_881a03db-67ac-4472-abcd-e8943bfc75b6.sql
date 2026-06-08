ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS management_token UUID DEFAULT gen_random_uuid();

-- Populate existing records that have null management_token
UPDATE public.appointments SET management_token = gen_random_uuid() WHERE management_token IS NULL;

-- Create function to get appointment by management token securely
CREATE OR REPLACE FUNCTION public.get_appointment_by_management_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
  barber_id uuid,
  service_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  payment_status text,
  total_price numeric,
  customer_name text,
  service_name text,
  professional_name text,
  business_name text,
  professional_id uuid,
  cancellation_window_hours integer,
  management_token uuid,
  cancel_token uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.tenant_id,
    a.customer_id,
    a.barber_id,
    a.service_id,
    a.start_time,
    a.end_time,
    a.status,
    a.payment_status,
    a.total_price,
    c.name as customer_name,
    s.name as service_name,
    b.name as professional_name,
    p.business_name,
    a.barber_id as professional_id,
    COALESCE(p.cancellation_window_hours, 2) as cancellation_window_hours,
    a.management_token,
    a.cancel_token
  FROM appointments a
  JOIN customers c ON a.customer_id = c.id
  JOIN services s ON a.service_id = s.id
  JOIN barbers b ON a.barber_id = b.id
  JOIN profiles p ON a.tenant_id = p.id
  WHERE a.management_token = p_token OR a.cancel_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_by_management_token(uuid) TO anon, authenticated;
