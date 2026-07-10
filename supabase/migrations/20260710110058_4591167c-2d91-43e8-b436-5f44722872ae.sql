
ALTER TABLE public.appointment_reviews
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_rating integer,
  ADD COLUMN IF NOT EXISTS allow_public_display boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply text,
  ADD COLUMN IF NOT EXISTS reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_reviews_service_rating_check'
  ) THEN
    ALTER TABLE public.appointment_reviews
      ADD CONSTRAINT appointment_reviews_service_rating_check
      CHECK (service_rating IS NULL OR (service_rating >= 1 AND service_rating <= 5));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_customer_review(_appointment_id uuid)
RETURNS SETOF public.appointment_reviews
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.appointment_reviews r
  JOIN public.appointments a ON a.id = r.appointment_id
  JOIN public.customers c ON c.id = a.customer_id
  WHERE r.appointment_id = _appointment_id
    AND (c.user_id = auth.uid() OR r.tenant_id = auth.uid())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_review(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_review_by_token(
  _token uuid,
  _barbershop_rating integer,
  _barber_rating integer,
  _service_rating integer DEFAULT NULL,
  _testimonial_text text DEFAULT NULL,
  _would_recommend text DEFAULT NULL,
  _allow_public_display boolean DEFAULT false,
  _service_id uuid DEFAULT NULL
)
RETURNS public.appointment_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.appointment_reviews;
BEGIN
  UPDATE public.appointment_reviews
     SET barbershop_rating = COALESCE(_barbershop_rating, barbershop_rating),
         barber_rating = COALESCE(_barber_rating, barber_rating),
         service_rating = COALESCE(_service_rating, service_rating),
         testimonial_text = COALESCE(NULLIF(trim(_testimonial_text), ''), testimonial_text),
         would_recommend = COALESCE(_would_recommend, would_recommend),
         allow_public_display = COALESCE(_allow_public_display, allow_public_display),
         service_id = COALESCE(_service_id, service_id),
         submitted_at = COALESCE(submitted_at, now()),
         token_used_at = now(),
         testimonial_status = 'pending',
         updated_at = now()
   WHERE review_token = _token
     AND (token_expires_at IS NULL OR token_expires_at > now())
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review_by_token(uuid, integer, integer, integer, text, text, boolean, uuid) TO anon, authenticated;
