-- Ajustando a tabela whatsapp_connections para o padrão Z-API
ALTER TABLE public.whatsapp_connections 
RENAME COLUMN instance_name TO instance_id;

ALTER TABLE public.whatsapp_connections 
RENAME COLUMN api_key TO instance_token;

-- Adicionando client_token
ALTER TABLE public.whatsapp_connections 
ADD COLUMN IF NOT EXISTS client_token TEXT;

-- Atualizar provider
ALTER TABLE public.whatsapp_connections 
ALTER COLUMN provider SET DEFAULT 'z-api';

UPDATE public.whatsapp_connections SET provider = 'z-api' WHERE provider = 'evolution';
