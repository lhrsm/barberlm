import { createClient } from "@supabase/supabase-js";

/**
 * Utilitário de rate limit seguro para o ambiente de borda (Edge).
 * Usa imports dinâmicos para o cliente administrativo e falha silenciosamente (fail-open).
 */
export async function enforceRateLimit(
  request: Request,
  bucket: string,
  opts: { max: number; windowSeconds: number; key?: string },
): Promise<Response | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = opts.key ?? (
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    );

    const { data, error } = await (supabaseAdmin.rpc as any)("check_rate_limit", {
      _bucket: bucket,
      _key: key,
      _max: opts.max,
      _window_seconds: opts.windowSeconds,
    });
    
    if (error) return null;
    if (data === false) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(opts.windowSeconds) },
      });
    }
    return null;
  } catch (err) {
    console.error("[RateLimit] Error", err);
    return null;
  }
}
