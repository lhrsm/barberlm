
-- Grants for loyalty premium tables (previously missing — caused empty templates page)
GRANT SELECT ON public.loyalty_campaign_templates TO anon, authenticated;
GRANT ALL ON public.loyalty_campaign_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_campaigns TO authenticated;
GRANT SELECT ON public.loyalty_campaigns TO anon;
GRANT ALL ON public.loyalty_campaigns TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_campaign_participations TO authenticated;
GRANT ALL ON public.loyalty_campaign_participations TO service_role;

-- Premium switch on loyalty_settings
ALTER TABLE public.loyalty_settings
  ADD COLUMN IF NOT EXISTS premium_enabled boolean NOT NULL DEFAULT false;
