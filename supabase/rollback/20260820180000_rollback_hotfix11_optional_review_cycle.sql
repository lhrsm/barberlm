-- ============================================================================
-- ROLLBACK HOTFIX 11: CICLO DE AVALIAÇÃO OPCIONAL DO CLIENTE
-- ============================================================================
-- ATENÇÃO: A execução deste rollback removerá a coluna review_decision e
-- consequentemente todas as decisões 'skipped' e 'submitted' armazenadas.
-- ============================================================================

-- 1. Remover Triggers
DROP TRIGGER IF EXISTS trg_validate_appointment_review_before_insert ON public.appointment_reviews;
DROP TRIGGER IF EXISTS trg_sync_appointment_review_decision ON public.appointment_reviews;
DROP TRIGGER IF EXISTS trg_appointment_completion_review_decision ON public.appointments;

-- 2. Revogar e remover RPC e Funções
DROP FUNCTION IF EXISTS public.set_appointment_review_decision(uuid, text);
DROP FUNCTION IF EXISTS public.validate_appointment_review_before_insert();
DROP FUNCTION IF EXISTS public.sync_appointment_review_decision();
DROP FUNCTION IF EXISTS public.handle_appointment_completion_review_decision();

-- 3. Remover Índice
DROP INDEX IF EXISTS public.idx_appointments_review_decision;

-- 4. Remover Constraint e Coluna
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_review_decision_check;

ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS review_decision;
