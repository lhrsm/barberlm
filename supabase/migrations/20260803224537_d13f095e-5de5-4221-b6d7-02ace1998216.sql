-- Tabela para Gerenciamento de Background Jobs (Filas)
CREATE TABLE public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id),
    queue_name TEXT NOT NULL DEFAULT 'default',
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, retry
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_run_at TIMESTAMPTZ DEFAULT NOW(),
    last_error TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS e Grants
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.background_jobs TO service_role;
GRANT SELECT ON public.background_jobs TO authenticated;

-- Índices para performance do Worker
CREATE INDEX idx_bg_jobs_status_next_run ON public.background_jobs(status, next_run_at) WHERE status IN ('pending', 'retry');
CREATE INDEX idx_bg_jobs_tenant_id ON public.background_jobs(tenant_id);

-- Trigger para atualização de updated_at
CREATE OR REPLACE FUNCTION public.update_bg_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_bg_jobs_updated_at
    BEFORE UPDATE ON public.background_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_bg_jobs_updated_at();

COMMENT ON TABLE public.background_jobs IS 'Fila de processamento assíncrono para tarefas de background e automações.';
