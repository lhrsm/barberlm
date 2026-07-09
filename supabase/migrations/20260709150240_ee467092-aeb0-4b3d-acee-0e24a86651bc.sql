UPDATE public.automation_templates
SET active = true, updated_at = now()
WHERE trigger_event LIKE 'appointment.rescheduled%'
  AND active = false;

-- Guarantee every reschedule template contains the management link footer
UPDATE public.automation_templates
SET template = template || E'\n\n🔗 Gerenciar agendamento:\n{management_link}',
    updated_at = now()
WHERE trigger_event LIKE 'appointment.rescheduled%'
  AND template NOT LIKE '%{management_link}%';