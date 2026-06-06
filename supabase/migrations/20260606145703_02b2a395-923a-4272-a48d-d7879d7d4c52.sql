ALTER TABLE public.automation_templates 
ADD COLUMN IF NOT EXISTS reprocessing_status TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS last_reprocessed_at TIMESTAMP WITH TIME ZONE;

-- Status can be: 'idle', 'processing', 'completed', 'failed'
GRANT UPDATE(reprocessing_status, last_reprocessed_at) ON public.automation_templates TO authenticated;
GRANT ALL ON public.automation_templates TO service_role;
