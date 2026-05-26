-- 1. Remover tabela antiga inconsistente
DROP TABLE IF EXISTS public.whatsapp_instances CASCADE;

-- 2. Renomear whatsapp_connections para whatsapp_instances
ALTER TABLE public.whatsapp_connections RENAME TO whatsapp_instances;

-- 3. Padronizar colunas conforme solicitado
ALTER TABLE public.whatsapp_instances RENAME COLUMN instance_token TO token;

-- 4. Garantir que o provedor seja z-api e adicionar client_token se não existir (já existe da whatsapp_connections)
UPDATE public.whatsapp_instances SET provider = 'z-api';

-- 5. Ajustar índices e constraints se necessário
-- (O rename já cuida da maioria das coisas)

-- 6. Garantir permissões (GRANT) para a nova tabela whatsapp_instances
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;

-- 7. Atualizar a tabela whatsapp_messages para refletir a mudança de nome (opcional, pois o FK segue o rename)
-- Mas vamos garantir que o nome da constraint faça sentido se quisermos ser perfeccionistas
-- ALTER TABLE public.whatsapp_messages RENAME CONSTRAINT whatsapp_messages_connection_id_fkey TO whatsapp_messages_instance_id_fkey;

-- 8. Garantir que a RLS esteja ativa
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- 9. Recriar as políticas se necessário (o rename costuma manter, mas vamos garantir as políticas corretas para 'whatsapp_instances')
DROP POLICY IF EXISTS "Barbers can manage their own whatsapp connections" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Owners can manage their shop's whatsapp" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can delete their own whatsapp connections" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can insert their own whatsapp connections" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can update their own whatsapp connections" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can view their own whatsapp connections" ON public.whatsapp_instances;

CREATE POLICY "Manage own whatsapp instances" 
ON public.whatsapp_instances 
FOR ALL 
USING (auth.uid() = tenant_id OR auth.uid() = barber_id OR auth.uid() = barbershop_id);

CREATE POLICY "View own whatsapp instances" 
ON public.whatsapp_instances 
FOR SELECT 
USING (auth.uid() = tenant_id OR auth.uid() = barber_id OR auth.uid() = barbershop_id);
