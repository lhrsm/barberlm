ALTER TABLE public.conversation_sessions
ADD COLUMN provider_message_id TEXT,
ADD COLUMN last_message_id TEXT;

-- Criar índices para busca rápida
CREATE INDEX idx_conversation_sessions_provider_message_id ON public.conversation_sessions(provider_message_id);
CREATE INDEX idx_conversation_sessions_last_message_id ON public.conversation_sessions(last_message_id);