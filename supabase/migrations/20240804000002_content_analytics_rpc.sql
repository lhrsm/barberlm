-- RPC to safely increment content views with upsert
CREATE OR REPLACE FUNCTION public.increment_content_views(c_type TEXT, c_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.content_analytics (content_type, content_id, views_count, last_viewed_at)
    VALUES (c_type, c_id, 1, now())
    ON CONFLICT (content_type, content_id)
    DO UPDATE SET 
        views_count = content_analytics.views_count + 1,
        last_viewed_at = now();
END;
$$;
