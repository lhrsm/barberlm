DROP POLICY IF EXISTS "Tenants can view their own conversations" ON public.automation_conversations;

CREATE POLICY "Tenants can view their own conversations"
ON public.automation_conversations
FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

GRANT SELECT ON public.automation_conversations TO authenticated;
GRANT ALL ON public.automation_conversations TO service_role;
