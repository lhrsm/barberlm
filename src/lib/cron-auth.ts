/**
 * Autenticação dos endpoints de cron em /api/public/hooks/*.
 *
 * O prefixo /api/public/ contorna a autenticação do site publicado, então cada
 * handler precisa validar o chamador. Usamos um segredo compartilhado
 * (CRON_SECRET) enviado pelo pg_cron no cabeçalho `x-cron-secret`.
 *
 * Falha fechada: se o segredo não estiver configurado no servidor, a requisição
 * é rejeitada.
 */
export function assertCronAuth(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("CRON_SECRET não configurado — endpoint de cron bloqueado");
    return new Response(JSON.stringify({ ok: false, error: "not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

/**
 * Variante para hooks que também podem ser disparados manualmente por um
 * super admin autenticado no painel (ex.: verificação de status).
 */
export async function assertCronOrSuperAdmin(request: Request): Promise<Response | null> {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (secret && provided === secret) return null;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const unauthorized = new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  if (!token) return unauthorized;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userRes } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return unauthorized;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    return isAdmin ? null : unauthorized;
  } catch {
    return unauthorized;
  }
}
