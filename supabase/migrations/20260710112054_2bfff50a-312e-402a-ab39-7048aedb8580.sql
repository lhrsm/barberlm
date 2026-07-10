
INSERT INTO public.automation_templates (tenant_id, key, name, trigger_event, recipient, category, channel, template, active)
SELECT p.id, 'review.received.customer', 'Agradecimento pela avaliação',
  'review.received', 'customer', 'review', 'whatsapp',
  '⭐ Obrigado, {customer_name}!

Sua avaliação foi recebida com sucesso e nos ajuda a evoluir sempre.

A equipe da *{barbershop_name}* agradece a sua confiança. Contamos com você em breve! 💈',
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_templates t
  WHERE t.tenant_id = p.id AND t.key = 'review.received.customer'
);

INSERT INTO public.automation_templates (tenant_id, key, name, trigger_event, recipient, category, channel, template, active)
SELECT p.id, 'review.excellent.customer', 'Agradecimento por avaliação 5 estrelas',
  'review.excellent', 'customer', 'review', 'whatsapp',
  '🌟 UAU, {customer_name}!

Ficamos muito felizes com sua avaliação máxima!

Para retribuir o carinho, use o cupom *VOLTAMAIS10* e ganhe 10% de desconto no seu próximo agendamento na *{barbershop_name}*.

Até breve! 💈✨',
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_templates t
  WHERE t.tenant_id = p.id AND t.key = 'review.excellent.customer'
);

DO $$
DECLARE
  cron_url text := 'https://project--8e95dc9e-ab64-44cf-956c-ecec6fefeb51.lovable.app/api/public/hooks/review-reminders';
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'review-pending-reply-reminders') THEN
    PERFORM cron.unschedule('review-pending-reply-reminders');
  END IF;

  PERFORM cron.schedule(
    'review-pending-reply-reminders',
    '*/30 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      ) as request_id;
    $cron$, cron_url)
  );
END $$;
