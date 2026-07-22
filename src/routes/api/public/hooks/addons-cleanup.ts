import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

/**
 * Hourly cron: efetiva cancelamentos de add-ons agendados
 * (cancel_at_period_end = true) cujo current_period_end já expirou.
 *
 * - Remove o subscription_item do Stripe (sem proration).
 * - Marca tenant_addons.status = 'canceled' e ended_at = now().
 */
export const Route = createFileRoute("/api/public/hooks/addons-cleanup")({
  server: {
    handlers: {
      POST: async () => {
        const sb = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const nowIso = new Date().toISOString();
        const { data: rows, error } = await sb
          .from("tenant_addons" as any)
          .select("id, tenant_id, addon_id, environment, stripe_subscription_item_id, current_period_end")
          .eq("cancel_at_period_end", true)
          .in("status", ["active", "trialing", "past_due"])
          .lte("current_period_end", nowIso)
          .limit(200);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        const results: Array<{ id: string; ok: boolean; error?: string }> = [];

        for (const r of (rows ?? []) as any[]) {
          try {
            const env = (r.environment ?? "sandbox") as StripeEnv;
            if (r.stripe_subscription_item_id) {
              const stripe = createStripeClient(env);
              try {
                await stripe.subscriptionItems.del(r.stripe_subscription_item_id, {
                  proration_behavior: "none",
                });
              } catch (e: any) {
                // Se o item já não existe no Stripe, apenas seguimos com o update local
                const msg = String(e?.message ?? "");
                if (!msg.includes("No such subscription_item")) throw e;
              }
            }

            await sb.from("tenant_addons" as any).update({
              status: "canceled",
              ended_at: nowIso,
            }).eq("id", r.id);

            // Emite evento admin (best-effort)
            try {
              await sb.functions.invoke("emit-admin-event", {
                body: {
                  event_key: "addon.effective_cancel",
                  title: "Add-on efetivamente cancelado",
                  message: `Contrato ${r.id} removido do Stripe ao fim do ciclo.`,
                  severity: "info",
                  tenant_id: r.tenant_id,
                  payload: { contract_id: r.id, addon_id: r.addon_id },
                },
              });
            } catch {}

            results.push({ id: r.id, ok: true });
          } catch (e: any) {
            console.error("[addons-cleanup] failed", r.id, e.message);
            results.push({ id: r.id, ok: false, error: e.message });
          }
        }

        return Response.json({
          ok: true,
          processed: results.length,
          succeeded: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          results,
        });
      },
    },
  },
});
