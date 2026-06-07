ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_refund_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_refund_status_check CHECK (refund_status = ANY (ARRAY['pending'::text, 'requested'::text, 'approved'::text, 'completed'::text, 'cancelled'::text]));
