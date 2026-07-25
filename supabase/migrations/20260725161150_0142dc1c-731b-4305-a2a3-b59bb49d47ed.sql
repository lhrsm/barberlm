
-- Tenants can insert their own recommendation logs
CREATE POLICY "tenant inserts own recommendations"
ON public.addon_upgrade_recommendations
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid());

-- Tenants can update their own recommendation logs (to record accept/dismiss)
CREATE POLICY "tenant updates own recommendations"
ON public.addon_upgrade_recommendations
FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());
