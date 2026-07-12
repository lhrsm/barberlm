
-- Token de check-in por barbearia (usado no QR)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS checkin_token TEXT UNIQUE;

-- Backfill: gera token para barbearias existentes
UPDATE public.profiles SET checkin_token = encode(gen_random_bytes(16), 'hex') WHERE checkin_token IS NULL AND role = 'admin';

-- Tabela de check-ins
CREATE TABLE IF NOT EXISTS public.appointment_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  customer_id UUID,
  source TEXT NOT NULL DEFAULT 'qr',
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

GRANT SELECT, INSERT ON public.appointment_checkins TO authenticated;
GRANT ALL ON public.appointment_checkins TO service_role;

ALTER TABLE public.appointment_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_checkins" ON public.appointment_checkins
  FOR SELECT TO authenticated USING (tenant_id = auth.uid());

CREATE POLICY "tenant_insert_checkins" ON public.appointment_checkins
  FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid());

-- RPC pública: resolve barbearia pelo token do QR
CREATE OR REPLACE FUNCTION public.get_barbershop_by_checkin_token(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.profiles%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RETURN NULL; END IF;
  SELECT * INTO v_row FROM public.profiles WHERE checkin_token = _token LIMIT 1;
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'tenant_id', v_row.id,
    'business_name', v_row.business_name,
    'slug', v_row.slug,
    'primary_color', v_row.primary_color,
    'logo_url', v_row.logo_url
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_barbershop_by_checkin_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_barbershop_by_checkin_token(TEXT) TO anon, authenticated;

-- RPC pública: cliente faz check-in com token do QR + telefone
CREATE OR REPLACE FUNCTION public.perform_qr_checkin(_token TEXT, _phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_customer_id UUID;
  v_appt public.appointments%ROWTYPE;
BEGIN
  SELECT id INTO v_tenant FROM public.profiles WHERE checkin_token = _token LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT id INTO v_customer_id FROM public.customers
    WHERE tenant_id = v_tenant AND regexp_replace(phone, '\D', '', 'g') = regexp_replace(_phone, '\D', '', 'g')
    LIMIT 1;
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'customer_not_found');
  END IF;
  SELECT * INTO v_appt FROM public.appointments
    WHERE tenant_id = v_tenant AND customer_id = v_customer_id
      AND start_time::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND status IN ('confirmed','scheduled','pending')
    ORDER BY start_time ASC LIMIT 1;
  IF v_appt.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_appointment_today', 'customer_id', v_customer_id);
  END IF;
  INSERT INTO public.appointment_checkins (appointment_id, tenant_id, customer_id, source)
    VALUES (v_appt.id, v_tenant, v_customer_id, 'qr')
    ON CONFLICT (appointment_id) DO NOTHING;
  RETURN jsonb_build_object(
    'ok', true,
    'appointment_id', v_appt.id,
    'start_time', v_appt.start_time,
    'customer_id', v_customer_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.perform_qr_checkin(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perform_qr_checkin(TEXT, TEXT) TO anon, authenticated;
