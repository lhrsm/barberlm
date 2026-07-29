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
