ALTER TABLE public.automation_queue ADD COLUMN IF NOT EXISTS appointment_group_id uuid REFERENCES public.appointment_groups(id) ON DELETE CASCADE;
GRANT ALL ON public.automation_queue TO service_role;
GRANT ALL ON public.automation_queue TO authenticated;