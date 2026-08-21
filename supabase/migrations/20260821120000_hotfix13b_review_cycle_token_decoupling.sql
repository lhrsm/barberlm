-- ============================================================================
-- HOTFIX 13B: DESACOPLAMENTO ESTRUTURAL DE REVIEW TOKEN E AVALIAÇÃO REAL
-- ============================================================================

-- 1. Função e Trigger para conclusão de atendimento (status -> 'completed')
-- Somente marca 'submitted' se existir avaliação REAL (submitted_at ou ratings preenchidos).
-- Placeholders/tokens vazios mantêm o agendamento como 'pending'.
CREATE OR REPLACE FUNCTION public.handle_appointment_completion_review_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' AND NEW.review_decision IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.appointment_reviews
        WHERE appointment_id = NEW.id
          AND (submitted_at IS NOT NULL OR service_rating IS NOT NULL OR barbershop_rating IS NOT NULL OR barber_rating IS NOT NULL)
      ) THEN
        NEW.review_decision := 'submitted';
      ELSE
        NEW.review_decision := 'pending';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed'
       AND OLD.status IS DISTINCT FROM 'completed'
       AND NEW.review_decision IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.appointment_reviews
        WHERE appointment_id = NEW.id
          AND (submitted_at IS NOT NULL OR service_rating IS NOT NULL OR barbershop_rating IS NOT NULL OR barber_rating IS NOT NULL)
      ) THEN
        NEW.review_decision := 'submitted';
      ELSE
        NEW.review_decision := 'pending';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_completion_review_decision ON public.appointments;
CREATE TRIGGER trg_appointment_completion_review_decision
  BEFORE INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_completion_review_decision();


-- 2. Trigger em appointment_reviews: Sincroniza review_decision = 'submitted'
-- Suporta INSERT (envio direto via portal) e UPDATE (submissão de placeholder via token).
-- Não dispara em moderação posterior (aprovação/rejeição de texto não toca em appointments).
CREATE OR REPLACE FUNCTION public.sync_appointment_review_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_submission boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_is_real_submission := (
      NEW.submitted_at IS NOT NULL OR
      NEW.service_rating IS NOT NULL OR
      NEW.barbershop_rating IS NOT NULL OR
      NEW.barber_rating IS NOT NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_is_real_submission := (
      (OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL) OR
      (OLD.service_rating IS NULL AND NEW.service_rating IS NOT NULL) OR
      (OLD.barbershop_rating IS NULL AND NEW.barbershop_rating IS NOT NULL) OR
      (OLD.barber_rating IS NULL AND NEW.barber_rating IS NOT NULL)
    );
  END IF;

  IF v_is_real_submission AND NEW.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET review_decision = 'submitted',
           updated_at = now()
     WHERE id = NEW.appointment_id
       AND (review_decision IS NULL OR review_decision != 'submitted');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_review_decision ON public.appointment_reviews;
CREATE TRIGGER trg_sync_appointment_review_decision
  AFTER INSERT OR UPDATE OF submitted_at, service_rating, barbershop_rating, barber_rating ON public.appointment_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_review_decision();


-- 3. RPC: set_appointment_review_decision
-- Permite ao cliente recusar (skipped) mesmo que exista placeholder/token, invalidando o token.
CREATE OR REPLACE FUNCTION public.set_appointment_review_decision(
  p_appointment_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_appt public.appointments;
  v_customer_id uuid;
  v_has_real_review boolean;
BEGIN
  -- 1. Autenticação obrigatória
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 2. Decisão manual via RPC é exclusivamente 'skipped'
  IF p_decision != 'skipped' THEN
    RAISE EXCEPTION 'invalid_decision: manual decision via RPC can only be skipped';
  END IF;

  -- 3. Lock exclusivo no agendamento
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found';
  END IF;

  -- 4. O agendamento precisa estar concluído
  IF v_appt.status != 'completed' THEN
    RAISE EXCEPTION 'appointment_not_completed: review decision is only applicable to completed appointments';
  END IF;

  -- 5. Validação estrita de posse
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE id = v_appt.customer_id
    AND tenant_id = v_appt.tenant_id
    AND auth_user_id = v_user_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: caller is not the owner of this appointment';
  END IF;

  -- 6. Rejeita skip se já existir avaliação REAL submetida
  SELECT EXISTS (
    SELECT 1 FROM public.appointment_reviews
    WHERE appointment_id = p_appointment_id
      AND (submitted_at IS NOT NULL OR service_rating IS NOT NULL OR barbershop_rating IS NOT NULL OR barber_rating IS NOT NULL)
  ) INTO v_has_real_review;

  IF v_has_real_review THEN
    RAISE EXCEPTION 'review_already_submitted: cannot skip an appointment with an existing real review';
  END IF;

  -- 7. Se já estiver submitted no agendamento, rejeita mudança
  IF v_appt.review_decision = 'submitted' THEN
    RAISE EXCEPTION 'cannot_change_submitted_decision';
  END IF;

  -- 8. Idempotência: se já estiver skipped, retorna sucesso sem erro
  IF v_appt.review_decision = 'skipped' THEN
    RETURN jsonb_build_object(
      'success', true,
      'appointment_id', p_appointment_id,
      'review_decision', 'skipped',
      'idempotent', true
    );
  END IF;

  -- 9. Invalida tokens/placeholders existentes para este agendamento
  UPDATE public.appointment_reviews
     SET token_expires_at = now()
   WHERE appointment_id = p_appointment_id
     AND submitted_at IS NULL;

  -- 10. Atualiza agendamento para skipped
  UPDATE public.appointments
     SET review_decision = 'skipped',
         updated_at = now()
   WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'review_decision', 'skipped'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_appointment_review_decision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_appointment_review_decision(uuid, text) TO authenticated;


-- 4. RPC: submit_review_by_token
-- Bloqueia submissão se o cliente já tiver marcado o atendimento como 'skipped'
CREATE OR REPLACE FUNCTION public.submit_review_by_token(
  _token uuid,
  _barbershop_rating int,
  _barber_rating int,
  _testimonial text,
  _would_recommend text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.appointment_reviews%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.appointment_reviews WHERE review_token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF rec.token_used_at IS NOT NULL OR rec.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_submitted');
  END IF;

  IF rec.token_expires_at IS NOT NULL AND rec.token_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired_token');
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = rec.appointment_id;
  IF v_appt.review_decision = 'skipped' THEN
    RETURN jsonb_build_object('success', false, 'error', 'review_decision_already_skipped');
  END IF;

  IF _barbershop_rating IS NULL OR _barbershop_rating < 1 OR _barbershop_rating > 5
     OR _barber_rating IS NULL OR _barber_rating < 1 OR _barber_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_rating');
  END IF;

  IF _would_recommend IS NOT NULL AND _would_recommend NOT IN ('yes','maybe','no') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_recommend');
  END IF;

  UPDATE public.appointment_reviews
     SET barbershop_rating = _barbershop_rating,
         barber_rating = _barber_rating,
         testimonial_text = NULLIF(trim(_testimonial), ''),
         would_recommend = _would_recommend,
         testimonial_status = CASE WHEN NULLIF(trim(_testimonial), '') IS NOT NULL THEN 'pending' ELSE testimonial_status END,
         submitted_at = now(),
         token_used_at = now()
   WHERE id = rec.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review_by_token(uuid, int, int, text, text) TO anon, authenticated;


-- 5. Backfill Corretivo Canônico:
-- 5.1 Completed COM review real -> 'submitted'
UPDATE public.appointments a
   SET review_decision = 'submitted'
 WHERE a.status = 'completed'
   AND (a.review_decision IS NULL OR a.review_decision != 'submitted')
   AND EXISTS (
     SELECT 1
       FROM public.appointment_reviews r
      WHERE r.appointment_id = a.id
        AND (r.submitted_at IS NOT NULL OR r.service_rating IS NOT NULL OR r.barbershop_rating IS NOT NULL OR r.barber_rating IS NOT NULL)
   );

-- 5.2 Completed SEM review real (incluindo os que tinham apenas placeholder token ou marcados indevidamente como submitted) -> 'pending' (preservando 'skipped')
UPDATE public.appointments a
   SET review_decision = 'pending'
 WHERE a.status = 'completed'
   AND a.review_decision IS DISTINCT FROM 'skipped'
   AND NOT EXISTS (
     SELECT 1
       FROM public.appointment_reviews r
      WHERE r.appointment_id = a.id
        AND (r.submitted_at IS NOT NULL OR r.service_rating IS NOT NULL OR r.barbershop_rating IS NOT NULL OR r.barber_rating IS NOT NULL)
   );

-- 6. Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
