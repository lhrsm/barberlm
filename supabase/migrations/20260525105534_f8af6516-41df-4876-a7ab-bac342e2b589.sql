-- Rename old table to preserve data if needed
ALTER TABLE IF EXISTS public.whatsapp_connections RENAME TO whatsapp_cloud_connections;

-- Create new whatsapp_connections table
CREATE TABLE public.whatsapp_connections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    barbershop_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'evolution',
    instance_name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    last_connection TIMESTAMP WITH TIME ZONE,
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own whatsapp connections"
ON public.whatsapp_connections
FOR SELECT
USING (auth.uid() = barbershop_id);

CREATE POLICY "Users can insert their own whatsapp connections"
ON public.whatsapp_connections
FOR INSERT
WITH CHECK (auth.uid() = barbershop_id);

CREATE POLICY "Users can update their own whatsapp connections"
ON public.whatsapp_connections
FOR UPDATE
USING (auth.uid() = barbershop_id);

CREATE POLICY "Users can delete their own whatsapp connections"
ON public.whatsapp_connections
FOR DELETE
USING (auth.uid() = barbershop_id);

-- Create trigger for updated_at if function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_whatsapp_connections_updated_at
        BEFORE UPDATE ON public.whatsapp_connections
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Add index for barbershop_id
CREATE INDEX idx_whatsapp_connections_barbershop_id ON public.whatsapp_connections(barbershop_id);
