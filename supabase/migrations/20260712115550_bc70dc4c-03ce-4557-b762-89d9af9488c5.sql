
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random')),
  ADD COLUMN IF NOT EXISTS accepts_tips BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.barber_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'pix',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  source TEXT NOT NULL DEFAULT 'review_link',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.barber_tips TO authenticated;
GRANT ALL ON public.barber_tips TO service_role;

ALTER TABLE public.barber_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owner sees own tips" ON public.barber_tips;
CREATE POLICY "Shop owner sees own tips" ON public.barber_tips
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Barber sees own tips" ON public.barber_tips;
CREATE POLICY "Barber sees own tips" ON public.barber_tips
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.user_id = auth.uid()));

DROP POLICY IF EXISTS "Shop owner updates tips" ON public.barber_tips;
CREATE POLICY "Shop owner updates tips" ON public.barber_tips
  FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

CREATE INDEX IF NOT EXISTS barber_tips_barber_idx ON public.barber_tips(barber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS barber_tips_tenant_idx ON public.barber_tips(tenant_id, created_at DESC);

-- Update review-by-token to also return PIX info for tipping
CREATE OR REPLACE FUNCTION public.get_review_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'tenant_id', r.tenant_id,
    'appointment_id', r.appointment_id,
    'customer_id', r.customer_id,
    'barber_id', r.barber_id,
    'service_id', a.service_id,
    'customer_name', c.name,
    'barber_name', b.name,
    'barber_avatar', b.avatar_url,
    'barber_pix_key', CASE WHEN COALESCE(b.accepts_tips, true) THEN b.pix_key ELSE NULL END,
    'barber_pix_key_type', CASE WHEN COALESCE(b.accepts_tips, true) THEN b.pix_key_type ELSE NULL END,
    'barber_accepts_tips', COALESCE(b.accepts_tips, true),
    'barbershop_name', p.business_name,
    'barbershop_slug', p.slug,
    'service_name', s.name,
    'appointment_date', a.start_time,
    'submitted_at', r.submitted_at,
    'token_used_at', r.token_used_at,
    'already_submitted', (r.submitted_at IS NOT NULL OR r.token_used_at IS NOT NULL)
  ) INTO result
  FROM public.appointment_reviews r
  JOIN public.appointments a ON a.id = r.appointment_id
  LEFT JOIN public.customers c ON c.id = r.customer_id
  LEFT JOIN public.barbers b ON b.id = r.barber_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = r.tenant_id
  WHERE r.review_token = _token
  LIMIT 1;

  RETURN result;
END;
$function$;

-- Register a PIX tip from the public review link
CREATE OR REPLACE FUNCTION public.register_pix_tip(
  _token UUID,
  _amount NUMERIC,
  _note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev RECORD;
  v_barber RECORD;
  v_tip_id UUID;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor inválido');
  END IF;

  SELECT r.tenant_id, r.barber_id, r.customer_id, r.appointment_id
    INTO v_rev
  FROM public.appointment_reviews r
  WHERE r.review_token = _token
  LIMIT 1;

  IF v_rev IS NULL OR v_rev.barber_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido');
  END IF;

  SELECT id, pix_key, accepts_tips INTO v_barber
  FROM public.barbers WHERE id = v_rev.barber_id;

  IF NOT COALESCE(v_barber.accepts_tips, true) OR v_barber.pix_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Barbeiro não aceita gorjetas digitais');
  END IF;

  INSERT INTO public.barber_tips (
    tenant_id, barber_id, appointment_id, customer_id, amount, method, status, source, note
  ) VALUES (
    v_rev.tenant_id, v_rev.barber_id, v_rev.appointment_id, v_rev.customer_id,
    _amount, 'pix', 'pending', 'review_link', NULLIF(_note, '')
  )
  RETURNING id INTO v_tip_id;

  RETURN jsonb_build_object('success', true, 'tip_id', v_tip_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_pix_tip(uuid, numeric, text) TO anon, authenticated;
