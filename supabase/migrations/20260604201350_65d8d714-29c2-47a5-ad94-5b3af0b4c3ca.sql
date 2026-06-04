DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_conversations' AND COLUMN_NAME = 'appointment_id') THEN
        ALTER TABLE automation_conversations ADD COLUMN appointment_id UUID REFERENCES public.appointments(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_conversations' AND COLUMN_NAME = 'workflow_key') THEN
        ALTER TABLE automation_conversations ADD COLUMN workflow_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_conversations' AND COLUMN_NAME = 'customer_phone') THEN
        ALTER TABLE automation_conversations ADD COLUMN customer_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_conversations' AND COLUMN_NAME = 'expected_response') THEN
        ALTER TABLE automation_conversations ADD COLUMN expected_response TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_conversations' AND COLUMN_NAME = 'confirmed_at') THEN
        ALTER TABLE automation_conversations ADD COLUMN confirmed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Update existing data if possible (best effort)
UPDATE automation_conversations SET appointment_id = selected_appointment_id WHERE appointment_id IS NULL AND selected_appointment_id IS NOT NULL;
UPDATE automation_conversations SET workflow_key = automation_type WHERE workflow_key IS NULL AND automation_type IS NOT NULL;
UPDATE automation_conversations SET customer_phone = phone WHERE customer_phone IS NULL AND phone IS NOT NULL;
