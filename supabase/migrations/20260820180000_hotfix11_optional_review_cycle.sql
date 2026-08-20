-- ============================================================================
-- HOTFIX 11: CICLO DE AVALIAÇÃO OPCIONAL DO CLIENTE (VERSÃO BLINDADA)
-- ============================================================================

-- 1. Adicionar coluna review_decision na tabela appointments (NULL por padrão, SEM DEFAULT 'pending')
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS review_decision TEXT;

-- 2. Constraint de integridade semântica para review_decision
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_review_decision_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_review_decision_check
      CHECK (review_decision IS NULL OR review_decision IN ('pending', 'submitted', 'skipped'));
  END IF;
END $$;

-- 3. Índice para performance de consultas do portal e rotinas de automação
CREATE INDEX IF NOT EXISTS idx_appointments_review_decision
  ON public.appointments(review_decision);

-- 4. Backfill Histórico Idempotente e Seguro:
-- 4.1. Completed COM review existente -> 'submitted'
UPDATE public.appointments a
   SET review_decision = 'submitted'
 WHERE a.status = 'completed'
   AND (a.review_decision IS NULL OR a.review_decision != 'submitted')
   AND EXISTS (
     SELECT 1
       FROM public.appointment_reviews r
      WHERE r.appointment_id = a.id
   );

-- 4.2. Completed SEM review existente -> 'pending'
UPDATE public.appointments a
   SET review_decision = 'pending'
 WHERE a.status = 'completed'
   AND a.review_decision IS NULL
   AND NOT EXISTS (
     SELECT 1
       FROM public.appointment_reviews r
      WHERE r.appointment_id = a.id
   );

-- 4.3. Não-completed permanecem review_decision = NULL (nenhuma ação necessária)


-- 5. Trigger em appointments para novos atendimentos concluídos (status -> 'completed')
-- Estrutura explícita isolando TG_OP = 'INSERT' e TG_OP = 'UPDATE' sem avaliar OLD em INSERTs
CREATE OR REPLACE FUNCTION public.handle_appointment_completion_review_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' AND NEW.review_decision IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.appointment_reviews WHERE appointment_id = NEW.id) THEN
        NEW.review_decision := 'submitted';
      ELSE
        NEW.review_decision := 'pending';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed'
       AND OLD.status IS DISTINCT FROM 'completed'
       AND NEW.review_decision IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.appointment_reviews WHERE appointment_id = NEW.id) THEN
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


-- 6. Trigger BEFORE INSERT em appointment_reviews: Blindagem de integridade e concorrência
-- Bloqueia a inserção se o agendamento não estiver completed ou se o cliente já optou por 'skipped'
CREATE OR REPLACE FUNCTION public.validate_appointment_review_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments;
BEGIN
  -- 1. Lock exclusivo no appointment correspondente para serialização estrita com RPC
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = NEW.appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found: appointment % does not exist', NEW.appointment_id;
  END IF;

  -- 2. O atendimento precisa obrigatoriamente estar concluído
  IF v_appt.status != 'completed' THEN
    RAISE EXCEPTION 'appointment_not_completed: cannot review appointment with status %', v_appt.status;
  END IF;

  -- 3. Decisão final e irreversível: se o cliente já recusou (skipped), rejeita INSERT
  IF v_appt.review_decision = 'skipped' THEN
    RAISE EXCEPTION 'review_decision_already_skipped: customer chose not to review this appointment';
  END IF;

  -- 4. Coerência de cliente e tenant
  IF v_appt.customer_id != NEW.customer_id OR v_appt.tenant_id != NEW.tenant_id THEN
    RAISE EXCEPTION 'inconsistent_review_target: customer or tenant does not match appointment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_appointment_review_before_insert ON public.appointment_reviews;
CREATE TRIGGER trg_validate_appointment_review_before_insert
  BEFORE INSERT ON public.appointment_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_review_before_insert();


-- 7. Trigger INSERT-ONLY em appointment_reviews: Sincroniza review_decision = 'submitted'
-- Não roda em UPDATE, garantindo que moderação não toque em appointments nem em updated_at
CREATE OR REPLACE FUNCTION public.sync_appointment_review_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
     SET review_decision = 'submitted',
         updated_at = now()
   WHERE id = NEW.appointment_id
     AND (review_decision IS NULL OR review_decision != 'submitted');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_review_decision ON public.appointment_reviews;
CREATE TRIGGER trg_sync_appointment_review_decision
  AFTER INSERT ON public.appointment_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_review_decision();


-- 8. RPC Segura: set_appointment_review_decision
-- Permite exclusivamente que o CLIENTE dono do agendamento decida por 'skipped' em atendimento 'completed' sem review.
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
BEGIN
  -- 1. Autenticação obrigatória
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 2. Decisão manual permitida via RPC é exclusivamente 'skipped' (submitted ocorre via trigger de review real)
  IF p_decision != 'skipped' THEN
    RAISE EXCEPTION 'invalid_decision: manual decision via RPC can only be skipped';
  END IF;

  -- 3. Lock exclusivo e leitura do agendamento para proteção de concorrência
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found';
  END IF;

  -- 4. O agendamento precisa obrigatoriamente estar concluído
  IF v_appt.status != 'completed' THEN
    RAISE EXCEPTION 'appointment_not_completed: review decision is only applicable to completed appointments';
  END IF;

  -- 5. Validação estrita de posse: Somente o cliente dono do agendamento pode recusar
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE id = v_appt.customer_id
    AND tenant_id = v_appt.tenant_id
    AND auth_user_id = v_user_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: caller is not the owner of this appointment';
  END IF;

  -- 6. Se já existir avaliação real submetida, não permite marcar skipped
  IF EXISTS (SELECT 1 FROM public.appointment_reviews WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'review_already_submitted: cannot skip an appointment with an existing review';
  END IF;

  -- 7. Irreversibilidade: se já estiver submitted, rejeita mudança
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

  -- 9. Transição válida: pending (ou NULL em completed) -> skipped
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

-- 9. Permissões de execução
REVOKE EXECUTE ON FUNCTION public.set_appointment_review_decision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_appointment_review_decision(uuid, text) TO authenticated;
