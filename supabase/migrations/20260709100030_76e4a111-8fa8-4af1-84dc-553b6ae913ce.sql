-- Disable legacy per-tenant templates that duplicate the new event-driven ones
UPDATE public.automation_templates
SET active = false, updated_at = now()
WHERE active = true
  AND key IN ('appointment_confirmation', 'appointment_reminder', 'appointment_cancellation')
  AND trigger_event IN ('appointment.created','appointment.confirmed','appointment.cancelled');
