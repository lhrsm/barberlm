-- 1. Remover chave estrangeira antiga
ALTER TABLE public.automation_logs DROP CONSTRAINT IF EXISTS automation_logs_automation_id_fkey;

-- 2. Limpar referências que não existem na nova tabela de templates
UPDATE public.automation_logs SET automation_id = NULL 
WHERE automation_id IS NOT NULL 
AND automation_id NOT IN (SELECT id FROM public.automation_templates);

-- 3. Adicionar nova chave estrangeira para templates
ALTER TABLE public.automation_logs 
ADD CONSTRAINT automation_logs_automation_id_fkey 
FOREIGN KEY (automation_id) REFERENCES public.automation_templates(id) ON DELETE SET NULL;
