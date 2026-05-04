ALTER TABLE public.transactions 
ADD COLUMN barber_id UUID REFERENCES public.barbers(id);

-- Atualizar RLS se necessário (geralmente não é preciso se o usuário já tem acesso à tabela)
