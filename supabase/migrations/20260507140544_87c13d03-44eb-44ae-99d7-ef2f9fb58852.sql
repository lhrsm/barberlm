-- Atualiza agendamentos passados de 'scheduled' para 'completed'
-- se eles já terminaram. Isso garante que a UI reflita a realidade
-- do serviço prestado.

UPDATE public.appointments
SET status = 'completed'
WHERE status = 'scheduled'
  AND end_time <= now();
