-- Add source column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zapi_webhook_debug' AND column_name='source') THEN
        ALTER TABLE public.zapi_webhook_debug ADD COLUMN source TEXT DEFAULT 'real';
    END IF;
END $$;

-- Ensure phone_normalized exists in automation_conversations
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_conversations' AND column_name='phone_normalized') THEN
        ALTER TABLE public.automation_conversations ADD COLUMN phone_normalized TEXT;
    END IF;
END $$;

-- Update existing records to have a source if empty
UPDATE public.zapi_webhook_debug SET source = 'real' WHERE source IS NULL;
