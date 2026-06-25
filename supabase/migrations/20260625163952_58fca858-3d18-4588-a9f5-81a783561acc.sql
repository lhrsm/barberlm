CREATE OR REPLACE FUNCTION public.get_barber_commissions(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  appointment_id uuid,
  customer_id uuid,
  customer_name text,
  service_id uuid,
  service_name text,
  service_amount numeric,
  commission_type text,
  commission_percentage numeric,
  commission_fixed_amount numeric,
  commission_amount numeric,
  status text,
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz,
  appointment_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bc.id,
    bc.appointment_id,
    bc.customer_id,
    c.name AS customer_name,
    bc.service_id,
    bc.service_name,
    bc.service_amount,
    bc.commission_type,
    bc.commission_percentage,
    bc.commission_fixed_amount,
    bc.commission_amount,
    bc.status,
    bc.paid_at,
    bc.paid_by,
    bc.created_at,
    a.start_time AS appointment_date
  FROM public.barber_commissions bc
  LEFT JOIN public.customers c ON c.id = bc.customer_id
  LEFT JOIN public.appointments a ON a.id = bc.appointment_id
  WHERE bc.tenant_id = p_tenant_id
    AND bc.barber_id = p_barber_id
    AND (p_status IS NULL OR bc.status = p_status)
    AND (p_start_date IS NULL OR bc.created_at >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR bc.created_at < (p_end_date + 1)::timestamptz)
  ORDER BY COALESCE(a.start_time, bc.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_commissions(uuid, uuid, date, date, text) TO anon, authenticated, service_role;