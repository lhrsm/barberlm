ALTER TABLE public.automation_webhook_logs 
ADD COLUMN IF NOT EXISTS phone_raw TEXT,
ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
ADD COLUMN IF NOT EXISTS incoming_text TEXT,
ADD COLUMN IF NOT EXISTS normalized_text TEXT,
ADD COLUMN IF NOT EXISTS matched_action TEXT,
ADD COLUMN IF NOT EXISTS conversation_found BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conversation_id UUID,
ADD COLUMN IF NOT EXISTS status_before TEXT,
ADD COLUMN IF NOT EXISTS status_after TEXT,
ADD COLUMN IF NOT EXISTS response_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS error TEXT;

-- Ensure automation_conversations has updated_at trigger if not already present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_automation_conversations_updated_at') THEN
        CREATE TRIGGER update_automation_conversations_updated_at
        BEFORE UPDATE ON public.automation_conversations
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
