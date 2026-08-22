-- Migration: Add contact_email to profiles table
-- Hotfix 17: Public Landing Header + Contact Form + Footer Refinement

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS contact_email text;

COMMENT ON COLUMN public.profiles.contact_email IS 'Dedicated email address to receive public contact form submissions from barbex.shop/';