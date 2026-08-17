-- Protocolo de Correção de Identidade Forense V2
-- Resolve o conflito de slug 'lm' que pertence a outra conta (louisdabahia@gmail.com)
-- Garante que louishenrique19@hotmail.com tenha um slug único e status 'completed'

UPDATE public.profiles 
SET identity_status = 'completed',
    slug = 'louis-henrique-19', -- Slug único para evitar conflito com 'lm'
    tenant_id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08'
WHERE id = '997746ee-723f-40e4-a6c6-5359eddd2a98';
