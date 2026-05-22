-- Tabela para mensagens dos tickets
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('barber_admin', 'super_admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para notificações do sistema (Super Admin)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reference_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para ticket_messages
CREATE POLICY "Mensagens visíveis por donos do ticket ou super admin"
    ON public.ticket_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets st 
            WHERE st.id = ticket_id 
            AND (st.user_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin')
        )
    );

CREATE POLICY "Inserção de mensagens permitida para donos do ticket ou super admin"
    ON public.ticket_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.support_tickets st 
            WHERE st.id = ticket_id 
            AND (st.user_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin')
        )
    );

-- Políticas para admin_notifications
CREATE POLICY "Notificações visíveis apenas para super admin"
    ON public.admin_notifications
    FOR SELECT
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Super admin pode atualizar notificações (marcar como lido)"
    ON public.admin_notifications
    FOR UPDATE
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

-- Habilitar Realtime para estas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

-- Trigger para criar notificação quando um ticket for aberto
CREATE OR REPLACE FUNCTION public.handle_new_ticket_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.admin_notifications (type, title, description, reference_id)
    VALUES ('new_ticket', 'Novo Chamado Aberto', 'Um novo chamado foi aberto por ' || (SELECT COALESCE(name, 'Barbearia') FROM public.barbershops WHERE id = NEW.barbershop_id), NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_ticket_created
    AFTER INSERT ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_ticket_notification();
