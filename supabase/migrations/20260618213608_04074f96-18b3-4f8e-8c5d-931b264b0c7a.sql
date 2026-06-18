
CREATE TABLE IF NOT EXISTS public.appointment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  barbershop_rating int CHECK (barbershop_rating BETWEEN 1 AND 5),
  barber_rating int CHECK (barber_rating BETWEEN 1 AND 5),
  testimonial_text text,
  testimonial_status text NOT NULL DEFAULT 'pending' CHECK (testimonial_status IN ('pending','approved','rejected')),
  show_on_frontend boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reviews TO authenticated;
GRANT SELECT, INSERT ON public.appointment_reviews TO anon;
GRANT ALL ON public.appointment_reviews TO service_role;

ALTER TABLE public.appointment_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert appointment reviews"
  ON public.appointment_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can read approved testimonials"
  ON public.appointment_reviews FOR SELECT
  TO anon, authenticated
  USING (testimonial_status = 'approved' AND show_on_frontend = true);

CREATE POLICY "Tenant owner can read all reviews"
  ON public.appointment_reviews FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Tenant owner can update reviews"
  ON public.appointment_reviews FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant owner can delete reviews"
  ON public.appointment_reviews FOR DELETE
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_appointment_reviews_tenant ON public.appointment_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reviews_barber ON public.appointment_reviews(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reviews_status ON public.appointment_reviews(testimonial_status);

CREATE OR REPLACE VIEW public.barber_rating_stats
WITH (security_invoker = on) AS
SELECT
  barber_id,
  tenant_id,
  ROUND(AVG(barber_rating)::numeric, 2) AS avg_rating,
  COUNT(barber_rating) AS total_ratings
FROM public.appointment_reviews
WHERE barber_rating IS NOT NULL
GROUP BY barber_id, tenant_id;

GRANT SELECT ON public.barber_rating_stats TO anon, authenticated, service_role;
