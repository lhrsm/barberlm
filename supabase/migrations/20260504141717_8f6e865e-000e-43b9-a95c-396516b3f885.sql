-- Create whatsapp_instances table
CREATE TABLE public.whatsapp_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected', -- disconnected, connected, pending, qr_ready
    qrcode TEXT, -- To store the base64 QR code or token
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own whatsapp instances" 
ON public.whatsapp_instances 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own whatsapp instances" 
ON public.whatsapp_instances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whatsapp instances" 
ON public.whatsapp_instances 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whatsapp instances" 
ON public.whatsapp_instances 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
