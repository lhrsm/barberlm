-- Fix for automation_conversations
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_conversations' AND COLUMN_NAME = 'phone') THEN
    ALTER TABLE public.automation_conversations ADD COLUMN phone TEXT;
  END IF;
END $$;

-- Fix for automation_webhook_logs buttonId column
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_webhook_logs' AND COLUMN_NAME = 'buttonId') THEN
    ALTER TABLE public.automation_webhook_logs ADD COLUMN "buttonId" TEXT;
  END IF;
END $$;

-- Grant permissions just in case
GRANT ALL ON public.automation_conversations TO service_role;
GRANT ALL ON public.automation_webhook_logs TO service_role;
GRANT ALL ON public.automation_conversations TO authenticated;
GRANT ALL ON public.automation_webhook_logs TO authenticated;
