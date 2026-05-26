-- 1. Remover políticas que dependem das colunas
DROP POLICY IF EXISTS "Manage own whatsapp instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "View own whatsapp instances" ON public.whatsapp_instances;

-- 2. Remover coluna tenant_id redundante
ALTER TABLE public.whatsapp_instances DROP COLUMN IF EXISTS tenant_id;

-- 3. Renomear barbershop_id para tenant_id
ALTER TABLE public.whatsapp_instances RENAME COLUMN barbershop_id TO tenant_id;

-- 4. Remover colunas não solicitadas
ALTER TABLE public.whatsapp_instances DROP COLUMN IF EXISTS last_connection;
ALTER TABLE public.whatsapp_instances DROP COLUMN IF EXISTS instance_name;

-- 5. Criar novas políticas RLS
CREATE POLICY "Manage own whatsapp instances" 
ON public.whatsapp_instances 
FOR ALL 
USING (auth.uid() = tenant_id OR auth.uid() = barber_id);

CREATE POLICY "View own whatsapp instances" 
ON public.whatsapp_instances 
FOR SELECT 
USING (auth.uid() = tenant_id OR auth.uid() = barber_id);
