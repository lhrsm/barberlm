
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Public can create product sales" ON public.product_sales;
CREATE POLICY "Authenticated tenant can create product sales"
  ON public.product_sales FOR INSERT TO authenticated
  WITH CHECK (
    barber_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.id = product_sales.barber_id
        AND b.tenant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view coupons by code" ON public.coupons;
CREATE POLICY "Tenant can view own coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_coupon_by_code(p_tenant_id uuid, p_code text)
RETURNS TABLE (
  id uuid, code text, type text, value numeric,
  minimum_amount numeric, max_discount numeric, usage_limit integer,
  used_count integer, expires_at timestamptz, active boolean,
  applies_to text, first_month_only boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, code, type, value, minimum_amount, max_discount,
         usage_limit, used_count, expires_at, active, applies_to, first_month_only
  FROM public.coupons
  WHERE tenant_id = p_tenant_id
    AND upper(code) = upper(p_code)
    AND active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_coupon_by_code(uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can create client auth" ON public.client_auth;

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload own avatar folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated can upload support attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload own ticket support attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.barbershop_id = auth.uid() OR t.user_id = auth.uid())
    )
  );
