
-- 1. Campos novos em barbers
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS commission_fixed_value numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_bonus_value numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_goal numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Configuração de base de cálculo no perfil da barbearia
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_base text NOT NULL DEFAULT 'gross';

-- 3. Tabela de lançamentos de comissão
CREATE TABLE IF NOT EXISTS public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  appointment_id uuid NOT NULL UNIQUE,
  customer_id uuid,
  service_amount numeric(10,2) NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percentage',
  commission_rate numeric(5,2) NOT NULL DEFAULT 0,
  commission_fixed numeric(10,2) NOT NULL DEFAULT 0,
  commission_bonus numeric(10,2) NOT NULL DEFAULT 0,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  closing_id uuid,
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_entries TO authenticated;
GRANT ALL ON public.commission_entries TO service_role;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages commission entries"
  ON public.commission_entries FOR ALL
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_commission_entries_tenant ON public.commission_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_entries_barber ON public.commission_entries(barber_id);
CREATE INDEX IF NOT EXISTS idx_commission_entries_status ON public.commission_entries(status);
CREATE INDEX IF NOT EXISTS idx_commission_entries_earned_at ON public.commission_entries(earned_at);

CREATE TRIGGER trg_commission_entries_updated_at
  BEFORE UPDATE ON public.commission_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tabela de fechamentos
CREATE TABLE IF NOT EXISTS public.commission_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_closings TO authenticated;
GRANT ALL ON public.commission_closings TO service_role;
ALTER TABLE public.commission_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages commission closings"
  ON public.commission_closings FOR ALL
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_commission_closings_tenant ON public.commission_closings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_closings_barber ON public.commission_closings(barber_id);

CREATE TRIGGER trg_commission_closings_updated_at
  BEFORE UPDATE ON public.commission_closings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Função de cálculo de comissão por atendimento
CREATE OR REPLACE FUNCTION public.calculate_commission_for_appointment(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appt RECORD;
  v_barber RECORD;
  v_base_mode text;
  v_base numeric(10,2);
  v_amount numeric(10,2) := 0;
  v_rate numeric(5,2) := 0;
  v_fixed numeric(10,2) := 0;
  v_bonus numeric(10,2) := 0;
  v_type text;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND OR v_appt.status <> 'completed' OR v_appt.barber_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_barber FROM public.barbers WHERE id = v_appt.barber_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(commission_base, 'gross') INTO v_base_mode
    FROM public.profiles WHERE id = v_appt.tenant_id;

  -- base de cálculo
  IF v_base_mode = 'net_cash' OR v_base_mode = 'custom' THEN
    v_base := GREATEST(0, COALESCE(v_appt.total_price,0)
                        - COALESCE(v_appt.credits_used, v_appt.credit_used, 0)
                        - COALESCE(v_appt.cashback_used, 0));
  ELSE
    v_base := COALESCE(v_appt.total_price, 0);
  END IF;

  v_type  := COALESCE(v_barber.commission_type, 'percentage');
  v_rate  := COALESCE(v_barber.commission_rate, 0);
  v_fixed := COALESCE(v_barber.commission_fixed_value, 0);
  v_bonus := COALESCE(v_barber.commission_bonus_value, 0);

  IF v_type = 'percentage' THEN
    v_amount := v_base * v_rate / 100.0;
  ELSIF v_type = 'fixed' THEN
    v_amount := v_fixed;
  ELSIF v_type = 'hybrid' THEN
    v_amount := (v_base * v_rate / 100.0) + v_bonus;
  END IF;

  IF v_amount <= 0 AND v_fixed = 0 THEN
    -- nada a registrar
    DELETE FROM public.commission_entries
      WHERE appointment_id = p_appointment_id AND status = 'pending';
    RETURN;
  END IF;

  INSERT INTO public.commission_entries (
    tenant_id, barber_id, appointment_id, customer_id,
    service_amount, commission_type, commission_rate, commission_fixed,
    commission_bonus, commission_amount, status, earned_at
  ) VALUES (
    v_appt.tenant_id, v_appt.barber_id, p_appointment_id, v_appt.customer_id,
    v_base, v_type, v_rate, v_fixed, v_bonus, v_amount,
    'pending', COALESCE(v_appt.completed_at, now())
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    service_amount = EXCLUDED.service_amount,
    commission_type = EXCLUDED.commission_type,
    commission_rate = EXCLUDED.commission_rate,
    commission_fixed = EXCLUDED.commission_fixed,
    commission_bonus = EXCLUDED.commission_bonus,
    commission_amount = CASE
      WHEN public.commission_entries.status = 'paid' THEN public.commission_entries.commission_amount
      ELSE EXCLUDED.commission_amount
    END,
    updated_at = now()
  WHERE public.commission_entries.status <> 'paid';
END;
$$;

-- 6. Trigger: ao concluir agendamento, recalcula comissão
CREATE OR REPLACE FUNCTION public.trg_commission_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.calculate_commission_for_appointment(NEW.id);
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    DELETE FROM public.commission_entries
      WHERE appointment_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_on_appointment ON public.appointments;
CREATE TRIGGER trg_commission_on_appointment
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_commission_on_appointment();

-- 7. RPC: pagamento (total ou parcial) de comissões selecionadas
CREATE OR REPLACE FUNCTION public.pay_commission_entries(
  p_barber_id uuid,
  p_entry_ids uuid[],
  p_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := auth.uid();
  v_total numeric(10,2) := 0;
  v_period_start date;
  v_period_end date;
  v_closing_id uuid;
  v_status text;
  v_remaining numeric(10,2);
  v_entry RECORD;
  v_pay numeric(10,2);
BEGIN
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT COALESCE(SUM(commission_amount - paid_amount), 0),
         MIN(earned_at)::date, MAX(earned_at)::date
    INTO v_total, v_period_start, v_period_end
    FROM public.commission_entries
   WHERE tenant_id = v_tenant
     AND barber_id = p_barber_id
     AND id = ANY(p_entry_ids)
     AND status <> 'paid';

  IF v_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending');
  END IF;

  IF p_amount >= v_total THEN
    v_status := 'paid';
  ELSE
    v_status := 'partially_paid';
  END IF;

  INSERT INTO public.commission_closings (
    tenant_id, barber_id, period_start, period_end,
    total_amount, paid_amount, status, paid_at, notes
  ) VALUES (
    v_tenant, p_barber_id, COALESCE(v_period_start, CURRENT_DATE), COALESCE(v_period_end, CURRENT_DATE),
    v_total, LEAST(p_amount, v_total), v_status, now(), p_notes
  ) RETURNING id INTO v_closing_id;

  v_remaining := LEAST(p_amount, v_total);

  FOR v_entry IN
    SELECT id, commission_amount, paid_amount
      FROM public.commission_entries
     WHERE tenant_id = v_tenant
       AND barber_id = p_barber_id
       AND id = ANY(p_entry_ids)
       AND status <> 'paid'
     ORDER BY earned_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_pay := LEAST(v_remaining, v_entry.commission_amount - v_entry.paid_amount);

    UPDATE public.commission_entries
       SET paid_amount = paid_amount + v_pay,
           status = CASE
             WHEN paid_amount + v_pay >= commission_amount THEN 'paid'
             ELSE 'partially_paid'
           END,
           closing_id = v_closing_id,
           updated_at = now()
     WHERE id = v_entry.id;

    v_remaining := v_remaining - v_pay;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'closing_id', v_closing_id, 'total', v_total, 'paid', LEAST(p_amount, v_total));
END;
$$;

-- 8. RPC: recalcular histórico
CREATE OR REPLACE FUNCTION public.recalculate_barber_commissions(
  p_tenant_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appt RECORD;
  v_count integer := 0;
BEGIN
  IF p_tenant_id IS DISTINCT FROM auth.uid() AND NOT public.is_super_admin() THEN
    RETURN 0;
  END IF;
  FOR v_appt IN
    SELECT id FROM public.appointments
     WHERE tenant_id = p_tenant_id
       AND status = 'completed'
       AND (p_from IS NULL OR completed_at::date >= p_from)
       AND (p_to   IS NULL OR completed_at::date <= p_to)
  LOOP
    PERFORM public.calculate_commission_for_appointment(v_appt.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
