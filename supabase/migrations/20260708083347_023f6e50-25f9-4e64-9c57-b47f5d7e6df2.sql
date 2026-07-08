
-- 1. Extend appointment_reviews with token + would_recommend + comment
ALTER TABLE public.appointment_reviews
  ADD COLUMN IF NOT EXISTS review_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS would_recommend text CHECK (would_recommend IN ('yes','maybe','no')),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_appointment_reviews_token ON public.appointment_reviews(review_token) WHERE review_token IS NOT NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_appointment_reviews_updated_at ON public.appointment_reviews;
CREATE TRIGGER update_appointment_reviews_updated_at
BEFORE UPDATE ON public.appointment_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Review automation logs
CREATE TABLE IF NOT EXISTS public.review_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL, -- sent | failed | skipped
  reason text,
  review_id uuid REFERENCES public.appointment_reviews(id) ON DELETE SET NULL,
  provider_message_id text,
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_log_per_appointment
  ON public.review_automation_logs(appointment_id)
  WHERE status IN ('sent','skipped');

CREATE INDEX IF NOT EXISTS idx_review_logs_tenant ON public.review_automation_logs(tenant_id, created_at DESC);

GRANT SELECT ON public.review_automation_logs TO authenticated;
GRANT ALL ON public.review_automation_logs TO service_role;

ALTER TABLE public.review_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owner reads review logs" ON public.review_automation_logs
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

-- 3. RPC: get review by token (public, anon)
CREATE OR REPLACE FUNCTION public.get_review_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'tenant_id', r.tenant_id,
    'appointment_id', r.appointment_id,
    'customer_name', c.name,
    'barber_name', b.name,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_review_by_token(uuid) TO anon, authenticated;

-- 4. RPC: submit review by token (public, anon)
CREATE OR REPLACE FUNCTION public.submit_review_by_token(
  _token uuid,
  _barbershop_rating int,
  _barber_rating int,
  _testimonial text,
  _would_recommend text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.appointment_reviews%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.appointment_reviews WHERE review_token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF rec.token_used_at IS NOT NULL OR rec.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_submitted');
  END IF;
  IF _barbershop_rating IS NULL OR _barbershop_rating < 1 OR _barbershop_rating > 5
     OR _barber_rating IS NULL OR _barber_rating < 1 OR _barber_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_rating');
  END IF;
  IF _would_recommend IS NOT NULL AND _would_recommend NOT IN ('yes','maybe','no') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_recommend');
  END IF;

  UPDATE public.appointment_reviews
     SET barbershop_rating = _barbershop_rating,
         barber_rating = _barber_rating,
         testimonial_text = NULLIF(trim(_testimonial), ''),
         would_recommend = _would_recommend,
         testimonial_status = CASE WHEN NULLIF(trim(_testimonial), '') IS NOT NULL THEN 'pending' ELSE testimonial_status END,
         submitted_at = now(),
         token_used_at = now()
   WHERE id = rec.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review_by_token(uuid, int, int, text, text) TO anon, authenticated;
