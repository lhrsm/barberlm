-- Ensure whatsapp_connections has tenant_id if not already there, using barbershop_id as the same
-- (It already has barbershop_id and barber_id)

-- Add a unique constraint to ensure only one WhatsApp connection per barbershop
-- First, clean up duplicates if any (keep the most recently updated)
DELETE FROM whatsapp_connections a USING whatsapp_connections b
WHERE a.updated_at < b.updated_at
AND a.barbershop_id = b.barbershop_id;

-- Now add unique constraint
ALTER TABLE whatsapp_connections DROP CONSTRAINT IF EXISTS unique_barbershop_whatsapp;
ALTER TABLE whatsapp_connections ADD CONSTRAINT unique_barbershop_whatsapp UNIQUE (barbershop_id);

-- Do the same for whatsapp_instances
DELETE FROM whatsapp_instances a USING whatsapp_instances b
WHERE a.updated_at < b.updated_at
AND a.tenant_id = b.tenant_id;

ALTER TABLE whatsapp_instances DROP CONSTRAINT IF EXISTS unique_tenant_whatsapp_instance;
ALTER TABLE whatsapp_instances ADD CONSTRAINT unique_tenant_whatsapp_instance UNIQUE (tenant_id);

-- Update RLS policies to allow barbershop owners to manage their shop's WhatsApp
-- Owners are identified by owner_id in barbershops table, but usually they have a profile with a specific role
-- Let's assume the tenant_id/barbershop_id check is sufficient for multi-tenancy

DROP POLICY IF EXISTS "Owners can manage their shop's whatsapp" ON whatsapp_connections;
CREATE POLICY "Owners can manage their shop's whatsapp"
ON whatsapp_connections
FOR ALL
USING (auth.uid() IN (
    SELECT id FROM profiles WHERE tenant_id = whatsapp_connections.barbershop_id
));

DROP POLICY IF EXISTS "Owners can manage their shop's instance" ON whatsapp_instances;
CREATE POLICY "Owners can manage their shop's instance"
ON whatsapp_instances
FOR ALL
USING (auth.uid() IN (
    SELECT id FROM profiles WHERE tenant_id = whatsapp_instances.tenant_id
));
