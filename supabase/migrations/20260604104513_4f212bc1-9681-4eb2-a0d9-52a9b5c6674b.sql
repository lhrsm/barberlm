-- Insert default workflows for all existing profiles (tenants) that have a valid tenant_id
INSERT INTO public.automation_v2_workflows (tenant_id, workflow_key, name, event_name, active)
SELECT DISTINCT tenant_id, 'confirmation_single', 'Confirmação de Agendamento (Único)', 'appointment.created', true
FROM public.profiles
WHERE tenant_id IS NOT NULL
ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

INSERT INTO public.automation_v2_workflows (tenant_id, workflow_key, name, event_name, active)
SELECT DISTINCT tenant_id, 'confirmation_multi', 'Confirmação de Agendamento (Múltiplo)', 'appointment.created', true
FROM public.profiles
WHERE tenant_id IS NOT NULL
ON CONFLICT (tenant_id, workflow_key) DO NOTHING;
