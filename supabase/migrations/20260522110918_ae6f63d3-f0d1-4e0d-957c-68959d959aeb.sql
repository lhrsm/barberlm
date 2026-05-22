-- Create barbershops table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for barbershops
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;

-- Migration: populate barbershops from existing profiles that have business info
INSERT INTO public.barbershops (id, name, slug, logo_url, owner_id)
SELECT id, business_name, COALESCE(slug, id::text), logo_url, id
FROM public.profiles
WHERE role IN ('admin', 'tenant_admin') AND business_name IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Policies for barbershops
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access for barbershops') THEN
        CREATE POLICY "Public read access for barbershops" ON public.barbershops FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update their own barbershop') THEN
        CREATE POLICY "Owners can update their own barbershop" ON public.barbershops FOR UPDATE USING (auth.uid() = owner_id);
    END IF;
END $$;

-- Fix support tables
DROP TABLE IF EXISTS public.support_messages;
DROP TABLE IF EXISTS public.support_tickets;

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  attachment_url TEXT,
  attachment_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT false,
  attachment_url TEXT,
  attachment_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies
CREATE POLICY "Tickets access" ON public.support_tickets
FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

CREATE POLICY "Tickets insert" ON public.support_tickets
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Tickets update" ON public.support_tickets
FOR UPDATE USING (auth.uid() = user_id OR public.is_super_admin());

CREATE POLICY "Messages access" ON public.support_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND (user_id = auth.uid() OR public.is_super_admin())
  )
);

CREATE POLICY "Messages insert" ON public.support_messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND (user_id = auth.uid() OR public.is_super_admin())
  )
);
