
-- Uma policy FOR ALL sem WITH CHECK explícito faz o Postgres reaproveitar o USING
-- como WITH CHECK para INSERT/UPDATE. Isso pode fazer o INSERT anônimo cair em erro RLS
-- mesmo com outra policy permissiva.  Separamos em uma policy SELECT-only equivalente.

-- appointments
DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.appointments;
CREATE POLICY "Tenant can view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (tenant_id = (SELECT profiles.id FROM public.profiles WHERE profiles.id = auth.uid()));

-- appointment_groups (mesmo padrão, se existir)
DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.appointment_groups;
CREATE POLICY "Tenant can view own appointment groups"
ON public.appointment_groups
FOR SELECT
TO authenticated
USING (tenant_id = (SELECT profiles.id FROM public.profiles WHERE profiles.id = auth.uid()));
