-- 1. Remover duplicados mantendo o mais recente
DELETE FROM public.automation_workflows a
WHERE a.id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY tenant_id, name, trigger_event 
                   ORDER BY created_at DESC
               ) as row_num
        FROM public.automation_workflows
    ) t
    WHERE t.row_num > 1
);

-- 2. Adicionar restrição de unicidade
ALTER TABLE public.automation_workflows
ADD CONSTRAINT automation_workflows_tenant_id_name_trigger_event_key 
UNIQUE (tenant_id, name, trigger_event);

-- 3. Função para deduplicar (caso necessário forçar via RPC ou similar futuramente)
CREATE OR REPLACE FUNCTION public.deduplicate_automation_workflows(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    DELETE FROM public.automation_workflows a
    WHERE a.tenant_id = p_tenant_id
    AND a.id IN (
        SELECT id
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY tenant_id, name, trigger_event 
                       ORDER BY created_at DESC
                   ) as row_num
            FROM public.automation_workflows
            WHERE tenant_id = p_tenant_id
        ) t
        WHERE t.row_num > 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
