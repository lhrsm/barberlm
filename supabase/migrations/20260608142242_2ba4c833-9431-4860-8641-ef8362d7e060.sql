-- 1. Alterar a coluna automation_id para permitir NULL
ALTER TABLE public.automation_logs ALTER COLUMN automation_id DROP NOT NULL;

-- 2. Grant para garantir que o log pode ser inserido por qualquer papel necessário (já deve existir, mas reforçando)
GRANT INSERT ON public.automation_logs TO authenticated;
GRANT ALL ON public.automation_logs TO service_role;
