-- Update notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Sync 'read' and 'is_read' for backward compatibility
UPDATE public.notifications SET is_read = read WHERE is_read IS NULL;
UPDATE public.notifications SET read = is_read WHERE read IS NULL;

-- Create a function to sync the two read columns
CREATE OR REPLACE FUNCTION sync_notification_read_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_read IS NOT NULL THEN
      NEW.read := NEW.is_read;
    ELSIF NEW.read IS NOT NULL THEN
      NEW.is_read := NEW.read;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
      NEW.read := NEW.is_read;
      IF NEW.is_read = true AND NEW.read_at IS NULL THEN
        NEW.read_at := now();
      END IF;
    ELSIF NEW.read IS DISTINCT FROM OLD.read THEN
      NEW.is_read := NEW.read;
      IF NEW.read = true AND NEW.read_at IS NULL THEN
        NEW.read_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to notifications
DROP TRIGGER IF EXISTS tr_sync_notification_read ON public.notifications;
CREATE TRIGGER tr_sync_notification_read
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION sync_notification_read_status();

-- Fix Appointments RLS Policies
DROP POLICY IF EXISTS "Barbers can view their own appointments" ON public.appointments;
CREATE POLICY "Barbers can view their own appointments"
ON public.appointments
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM barbers 
    WHERE barbers.id = appointments.barber_id 
    AND barbers.user_id = auth.uid()
  ))
  OR 
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'tenant_admin', 'super_admin')
  ))
  OR
  (auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Barbers can update their own appointments" ON public.appointments;
CREATE POLICY "Barbers can update their own appointments"
ON public.appointments
FOR UPDATE
USING (
  (EXISTS (
    SELECT 1 FROM barbers 
    WHERE barbers.id = appointments.barber_id 
    AND barbers.user_id = auth.uid()
  ))
  OR 
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'tenant_admin', 'super_admin')
  ))
  OR
  (auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Barbers can delete their own appointments" ON public.appointments;
CREATE POLICY "Barbers can delete their own appointments"
ON public.appointments
FOR DELETE
USING (
  (EXISTS (
    SELECT 1 FROM barbers 
    WHERE barbers.id = appointments.barber_id 
    AND barbers.user_id = auth.uid()
  ))
  OR 
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'tenant_admin', 'super_admin')
  ))
  OR
  (auth.uid() = user_id)
);

-- Fix Notifications RLS Policies
DROP POLICY IF EXISTS "Barbeiros podem ver suas próprias notificações" ON public.notifications;
CREATE POLICY "Barbeiros podem ver suas próprias notificações"
ON public.notifications
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM barbers 
    WHERE barbers.id = notifications.barber_id 
    AND barbers.user_id = auth.uid()
  ))
  OR
  (user_id = auth.uid())
  OR
  (is_super_admin_user())
);

DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
CREATE POLICY "Users can manage their own notifications"
ON public.notifications
FOR ALL
USING (
  (EXISTS (
    SELECT 1 FROM barbers 
    WHERE barbers.id = notifications.barber_id 
    AND barbers.user_id = auth.uid()
  ))
  OR
  (user_id = auth.uid())
  OR
  (is_super_admin_user())
);
