CREATE TABLE IF NOT EXISTS public.automation_reconciliation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id),
    reconciliation_interval_minutes INTEGER DEFAULT 15,
    pending_callback_alert_threshold INTEGER DEFAULT 10,
    not_found_alert_threshold INTEGER DEFAULT 5,
    alert_period_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.automation_reconciliation_settings TO authenticated;
GRANT ALL ON public.automation_reconciliation_settings TO service_role;
ALTER TABLE public.automation_reconciliation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own settings" ON public.automation_reconciliation_settings FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);

-- Ensure we have a default record for each tenant (will be created on first access or via trigger)
-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reconciliation_settings_updated_at
    BEFORE UPDATE ON automation_reconciliation_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();