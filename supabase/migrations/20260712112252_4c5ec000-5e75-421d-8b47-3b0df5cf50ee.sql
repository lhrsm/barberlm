
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_key_time ON public.rate_limit_hits (bucket, key, hit_at DESC);
GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_rl" ON public.rate_limit_hits FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket TEXT, _key TEXT, _max INT, _window_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.rate_limit_hits WHERE hit_at < now() - INTERVAL '1 day';
  SELECT COUNT(*) INTO v_count FROM public.rate_limit_hits
    WHERE bucket = _bucket AND key = _key AND hit_at > now() - (_window_seconds || ' seconds')::INTERVAL;
  IF v_count >= _max THEN
    RETURN false;
  END IF;
  INSERT INTO public.rate_limit_hits (bucket, key) VALUES (_bucket, _key);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) TO service_role;
