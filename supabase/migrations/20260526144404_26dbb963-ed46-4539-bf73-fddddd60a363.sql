-- 1. Remover a constraint antiga (se existir)
ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_connection_id_fkey;

-- 2. Adicionar a nova constraint apontando para whatsapp_instances
ALTER TABLE public.whatsapp_messages 
ADD CONSTRAINT whatsapp_messages_connection_id_fkey 
FOREIGN KEY (connection_id) REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;
