ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS webhook_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');

UPDATE public.whatsapp_instances
  SET webhook_token = replace(gen_random_uuid()::text, '-', '')
  WHERE webhook_token IS NULL OR webhook_token = '';

CREATE INDEX IF NOT EXISTS whatsapp_instances_webhook_token_idx
  ON public.whatsapp_instances (webhook_token);