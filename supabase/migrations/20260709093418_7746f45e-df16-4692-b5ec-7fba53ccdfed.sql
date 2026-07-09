-- Consolidate appointment automation triggers to avoid duplicate WhatsApp messages.
-- The event-driven system (emit-automation-event) now handles fanout for new,
-- confirmed, cancelled, completed and rescheduled appointments. Legacy triggers
-- that also enqueued the old "appointment_confirmation" workflow are removed,
-- and the generic automation trigger is restricted to UPDATE events only so
-- 'appointment.created' is not enqueued twice.

DROP TRIGGER IF EXISTS tr_appointment_confirmation ON public.appointments;
DROP TRIGGER IF EXISTS tr_enqueue_new_appointment ON public.appointments;

DROP TRIGGER IF EXISTS on_appointment_change ON public.appointments;
CREATE TRIGGER on_appointment_change
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trigger_appointment_automation();
