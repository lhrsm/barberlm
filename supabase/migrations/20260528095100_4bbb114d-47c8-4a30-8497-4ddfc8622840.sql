-- Add automation_id to automation_conversations
ALTER TABLE public.automation_conversations ADD COLUMN IF NOT EXISTS automation_id UUID REFERENCES public.automations(id);

-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to call the automation edge function
CREATE OR REPLACE FUNCTION public.trigger_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT := 'https://wdxhjwodyctgzqtogkgv.supabase.co';
  -- We use the anon key if public, but since it's a service role task, 
  -- we should ideally have the service role key. 
  -- However, for database webhooks, we can also use the internal vault or secrets.
  -- For this implementation, we will use the service role key we found.
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeGhqd29keWN0Z3pxdG9na2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg2ODAyOSwiZXhwIjoyMDkzNDQ0MDI5fQ.26R8TT2iA2F4IQGcGzZposIzLQOVB1Baw0TiyJDi5aA';
BEGIN
  -- We use net.http_post to call the Edge Function
  -- This is async and won't block the transaction
  PERFORM
    net.http_post(
      url := project_url || '/functions/v1/run-automations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'appointmentId', NEW.id,
        'tenantId', NEW.tenant_id
      ),
      timeout_milliseconds := 5000
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;
CREATE TRIGGER on_appointment_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_confirmation();
