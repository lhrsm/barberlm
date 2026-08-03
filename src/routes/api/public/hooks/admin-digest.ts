import { createFileRoute } from "@tanstack/react-router";
import { assertCronAuth } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * Digest diário/semanal do super admin.
 * Chamado por pg_cron. Query param: ?period=daily|weekly
 *
 * Agrega admin_event_log na janela e emite `admin.digest_daily` ou
 * `admin.digest_weekly`, que é entregue via fan-out normal
 * (painel + push + whatsapp + email) conforme assinaturas dos admins.
 */
export const Route = createFileRoute("/api/public/hooks/admin-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = assertCronAuth(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const period = (url.searchParams.get("period") ?? "daily") as "daily" | "weekly";
        const hours = period === "weekly" ? 168 : 24;

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !KEY) return new Response("Missing env", { status: 500 });

        const supabase = createClient(SUPABASE_URL, KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: digestJson, error } = await supabase.rpc("generate_admin_digest", { _hours: hours });
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        const d: any = digestJson ?? {};
        const top = Array.isArray(d.top_events) ? d.top_events : [];
        const topText = top.length
          ? top.slice(0, 5).map((e: any) => `• ${e.event}: ${e.count}`).join("\n")
          : "(sem eventos na janela)";

        const summary =
          `📊 *Barbex — Resumo ${period === "weekly" ? "semanal" : "diário"}*\n\n` +
          `• Novos tenants: ${d.new_tenants ?? 0}\n` +
          `• Novas assinaturas: ${d.new_subscriptions ?? 0}\n` +
          `• Novos agendamentos: ${d.new_appointments ?? 0}\n` +
          `• Eventos totais: ${d.total_events ?? 0}\n` +
          `• Eventos críticos: ${d.critical_events ?? 0}\n\n` +
          `*Top eventos:*\n${topText}`;

        const event_key = period === "weekly" ? "admin.digest_weekly" : "admin.digest_daily";
        const title = period === "weekly" ? "📈 Resumo semanal Barbex" : "📊 Resumo diário Barbex";

        await supabase.functions.invoke("emit-admin-event", {
          body: {
            event_key,
            title,
            message: summary,
            severity: "info",
            action_url: "/admin",
            payload: { ...d, summary },
          },
        });

        return new Response(JSON.stringify({ ok: true, period, digest: d }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
