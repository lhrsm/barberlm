-- Tabela para Controle de Idempotência e Concorrência (Locks Otimistas)
CREATE TABLE public.operation_locks (
    key TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS e Grants
ALTER TABLE public.operation_locks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.operation_locks TO service_role;
GRANT ALL ON public.operation_locks TO authenticated;

-- Política de limpeza automática (pode ser via cron ou trigger de expiração)
CREATE INDEX idx_operation_locks_expires_at ON public.operation_locks(expires_at);

-- Tabela de Logs de Auditoria Estruturados (Performance e Rastreabilidade)
CREATE TABLE public.observability_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id),
    correlation_id TEXT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    operation TEXT,
    duration_ms FLOAT,
    metadata JSONB,
    error JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_obs_logs_tenant_id ON public.observability_logs(tenant_id);
CREATE INDEX idx_obs_logs_correlation_id ON public.observability_logs(correlation_id);
CREATE INDEX idx_obs_logs_created_at ON public.observability_logs(created_at);

ALTER TABLE public.observability_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.observability_logs TO service_role;
GRANT SELECT ON public.observability_logs TO authenticated;

COMMENT ON TABLE public.operation_locks IS 'Gerenciamento de concorrência e idempotência para operações críticas.';
COMMENT ON TABLE public.observability_logs IS 'Logs estruturados para observabilidade Enterprise e auditoria de performance.';
