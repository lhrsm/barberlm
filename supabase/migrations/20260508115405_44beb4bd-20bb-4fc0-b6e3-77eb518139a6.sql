-- Adicionar campos de reembolso à tabela de agendamentos
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_type TEXT CHECK (refund_type IN ('credits', 'refund')),
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'pending' CHECK (refund_status IN ('pending', 'completed', 'cancelled'));

-- Comentário para documentação
COMMENT ON COLUMN public.appointments.refund_type IS 'Tipo de reembolso escolhido pelo cliente: credits ou refund (estorno)';
COMMENT ON COLUMN public.appointments.refund_status IS 'Status do processo de reembolso: pending, completed ou cancelled';
