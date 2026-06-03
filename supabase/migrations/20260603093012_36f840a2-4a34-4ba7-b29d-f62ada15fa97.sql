-- Add tracking columns to automation_workflows
ALTER TABLE public.automation_workflows
ADD COLUMN last_execution_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN total_sent INTEGER DEFAULT 0,
ADD COLUMN total_failed INTEGER DEFAULT 0;

-- Function to update workflow stats from logs
CREATE OR REPLACE FUNCTION public.update_workflow_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status = 'success') THEN
            UPDATE public.automation_workflows 
            SET total_sent = total_sent + 1,
                last_execution_at = NEW.created_at
            WHERE id = NEW.workflow_id;
        ELSIF (NEW.status = 'error') THEN
            UPDATE public.automation_workflows 
            SET total_failed = total_failed + 1,
                last_execution_at = NEW.created_at
            WHERE id = NEW.workflow_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to update stats when a log is inserted
CREATE TRIGGER tr_update_workflow_stats
AFTER INSERT ON public.automation_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_workflow_stats();

-- Seed default templates (optional: we can also do this via the UI, but let's put some defaults)
-- Note: These will only be inserted if they don't exist for the tenant during a "load defaults" action, 
-- but I'll provide a way to insert them for current tenants or as models.
