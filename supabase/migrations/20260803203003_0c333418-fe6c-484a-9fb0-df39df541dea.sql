-- CRM Interactions (Notes)
CREATE TABLE public.customer_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    tenant_id uuid REFERENCES public.profiles(id) NOT NULL,
    author_id uuid REFERENCES public.profiles(id) NOT NULL,
    type text DEFAULT 'note' NOT NULL, -- note, call, visit, whatsapp, system
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_interactions TO authenticated;
GRANT ALL ON public.customer_interactions TO service_role;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own tenant customer interactions" ON public.customer_interactions
    TO authenticated
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- CRM Tasks
CREATE TABLE public.customer_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    tenant_id uuid REFERENCES public.profiles(id) NOT NULL,
    author_id uuid REFERENCES public.profiles(id) NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending' NOT NULL, -- pending, completed, cancelled
    due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tasks TO authenticated;
GRANT ALL ON public.customer_tasks TO service_role;
ALTER TABLE public.customer_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own tenant customer tasks" ON public.customer_tasks
    TO authenticated
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- CRM Documents
CREATE TABLE public.customer_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    tenant_id uuid REFERENCES public.profiles(id) NOT NULL,
    name text NOT NULL,
    file_url text,
    file_type text,
    category text DEFAULT 'other', -- contract, authorization, photo, other
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_documents TO authenticated;
GRANT ALL ON public.customer_documents TO service_role;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own tenant customer documents" ON public.customer_documents
    TO authenticated
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- Add triggers for updated_at
CREATE TRIGGER update_customer_interactions_updated_at BEFORE UPDATE ON public.customer_interactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_tasks_updated_at BEFORE UPDATE ON public.customer_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
