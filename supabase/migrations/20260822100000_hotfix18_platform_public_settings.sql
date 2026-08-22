-- Migration: Add public branding and contact fields to system_settings
-- Hotfix 18: Institutional Barbex Landing Page + Global Contact + Footer Refinement

ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS public_email text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.system_settings.public_email IS 'Institutional public email address displayed on barbex.shop landing';
COMMENT ON COLUMN public.system_settings.contact_email IS 'Internal recipient email for contact messages submitted via barbex.shop/#contato';
COMMENT ON COLUMN public.system_settings.whatsapp_number IS 'Official Barbex WhatsApp number for direct institutional chat';
COMMENT ON COLUMN public.system_settings.social_links IS 'JSON object with official Barbex social links: instagram, facebook, tiktok, linkedin, youtube, twitter';
