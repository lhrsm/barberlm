import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (adminClient) return adminClient;
  adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return adminClient;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Returns null when allowed, or a 429 Response when the limit is exceeded.
 * Fails open on backend errors so a DB hiccup never blocks legitimate traffic.
 */
export async function enforceRateLimit(
  request: Request,
  bucket: string,
  opts: { max: number; windowSeconds: number; key?: string },
): Promise<Response | null> {
  try {
    const key = opts.key ?? getClientIp(request);
    const { data, error } = await getAdmin().rpc("check_rate_limit", {
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
  } catch {
    return null;
  }
}
