import { createFileRoute } from "@tanstack/react-router";
import { assertCronAuth } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron diário: dispara eventos de risco para super admins.
 *  - subscription.trial_ending: trial expira nos próximos 3 dias
 *  - tenant.inactive: barbearia sem agendamento nos últimos 7 dias
 *
 * Idempotência: usa admin_event_log para evitar reenviar o mesmo evento
 * para o mesmo tenant dentro de uma janela (trial=diário, inativo=7d).
 */
export const Route = createFileRoute("/api/public/hooks/admin-risk-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = assertCronAuth(request);
        if (denied) return denied;

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !KEY) return new Response("Missing env", { status: 500 });

        const supabase = createClient(SUPABASE_URL, KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const now = new Date();
        const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const days7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const days1ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const days8ago = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

        const emit = async (args: {
          event_key: string;
          title: string;
          message: string;
          severity: "info" | "warning" | "critical";
          tenant_id: string;
          payload: Record<string, unknown>;
        }) => {
          try {
            await supabase.functions.invoke("emit-admin-event", {
              body: { ...args, action_url: "/admin/tenants" },
            });
          } catch (e) {
            console.warn("[admin-risk-scan] emit failed", args.event_key, (e as Error).message);
          }
        };

        const wasEmitted = async (event_key: string, tenant_id: string, sinceIso: string) => {
          const { data } = await supabase
            .from("admin_event_log")
            .select("id")
            .eq("event_key", event_key)
            .eq("tenant_id", tenant_id)
            .gte("created_at", sinceIso)
            .limit(1)
            .maybeSingle();
          return !!data;
        };

        let trialCount = 0;
        let inactiveCount = 0;

        // ── 1) Trials expirando em ≤3d ────────────────────────────────
        const { data: trials } = await supabase
          .from("profiles")
          .select("id, business_name, email, trial_end")
          .not("trial_end", "is", null)
          .gte("trial_end", now.toISOString())
          .lte("trial_end", in3d.toISOString());

        for (const t of trials ?? []) {
          if (await wasEmitted("subscription.trial_ending", t.id as string, days1ago.toISOString()))
            continue;
          const daysLeft = Math.max(
            0,
            Math.ceil((new Date(t.trial_end as string).getTime() - now.getTime()) / 86_400_000),
          );
          await emit({
            event_key: "subscription.trial_ending",
            title: "Trial próximo do fim",
            message: `${t.business_name ?? t.email ?? t.id} — ${daysLeft} dia(s) restante(s)`,
            severity: "warning",
            tenant_id: t.id as string,
            payload: { trial_end: t.trial_end, days_left: daysLeft },
          });
          trialCount++;
        }

        // ── 2) Tenants inativos 7d (sem agendamento criado) ────────────
        const { data: tenants } = await supabase
          .from("profiles")
          .select("id, business_name, email")
          .in("role", ["admin", "shop_owner"]);

        for (const t of tenants ?? []) {
          if (await wasEmitted("tenant.inactive", t.id as string, days8ago.toISOString()))
            continue;

          const { count } = await supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("user_id", t.id as string)
            .gte("created_at", days7ago.toISOString());

          if ((count ?? 0) === 0) {
            await emit({
              event_key: "tenant.inactive",
              title: "Tenant inativo há 7 dias",
              message: `${t.business_name ?? t.email ?? t.id} não registra agendamentos há 7 dias`,
              severity: "warning",
              tenant_id: t.id as string,
              payload: { since: days7ago.toISOString() },
            });
            inactiveCount++;
          }
        }

        return Response.json({
          ok: true,
          trial_ending: trialCount,
          inactive: inactiveCount,
          scanned_at: now.toISOString(),
        });
      },
    },
  },
});
