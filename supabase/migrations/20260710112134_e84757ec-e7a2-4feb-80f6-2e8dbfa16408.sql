
ALTER TABLE public.appointment_reviews
  ADD COLUMN IF NOT EXISTS reply_reminder_sent_at TIMESTAMPTZ;
