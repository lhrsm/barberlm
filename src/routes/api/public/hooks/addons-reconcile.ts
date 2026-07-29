import { createFileRoute } from "@tanstack/react-router";
import { assertCronAuth } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

/**
 * Daily cron: reconcilia tenant_addons com o estado real do Stripe.
 *
 * Para cada add-on marcado como ativo/trialing/past_due:
 *  - busca a subscription no Stripe
 *  - se o subscription_item não existir mais → status = 'canceled'
 *  - se existir → atualiza status, current_period_end e cancel_at_period_end
 *
 * Roda com service_role e ignora contratos sem stripe_subscription_item_id.
 */
export const Route = createFileRoute("/api/public/hooks/addons-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = assertCronAuth(request);
        if (denied) return denied;

        const sb = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: rows, error } = await sb
          .from("tenant_addons" as any)
          .select("id, tenant_id, environment, stripe_subscription_id, stripe_subscription_item_id, status")
          .in("status", ["active", "trialing", "past_due"])
          .not("stripe_subscription_item_id", "is", null)
          .limit(500);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        let checked = 0;
        let fixed = 0;
        const drifts: Array<{ id: string; reason: string }> = [];

        for (const r of (rows ?? []) as any[]) {
          checked++;
          const env = (r.environment ?? "sandbox") as StripeEnv;
          try {
            const stripe = createStripeClient(env);
            const sub = await stripe.subscriptions.retrieve(r.stripe_subscription_id);
            const item = sub.items?.data?.find((it: any) => it.id === r.stripe_subscription_item_id);

            if (!item) {
              await sb.from("tenant_addons" as any).update({
                status: "canceled",
                ended_at: new Date().toISOString(),
              }).eq("id", r.id);
              drifts.push({ id: r.id, reason: "item_missing_in_stripe" });
              fixed++;
              continue;
            }

            const periodEnd = (item as any).current_period_end ?? (sub as any).current_period_end;
            const patch: Record<string, any> = {};
            if (sub.status && sub.status !== r.status) patch.status = sub.status;
            if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();
            if (typeof sub.cancel_at_period_end === "boolean") patch.cancel_at_period_end = sub.cancel_at_period_end;

            if (Object.keys(patch).length) {
              await sb.from("tenant_addons" as any).update(patch).eq("id", r.id);
              drifts.push({ id: r.id, reason: `synced:${Object.keys(patch).join(",")}` });
              fixed++;
            }
          } catch (e: any) {
            const msg = String(e?.message ?? "");
            if (msg.includes("No such subscription")) {
              await sb.from("tenant_addons" as any).update({
                status: "canceled",
                ended_at: new Date().toISOString(),
              }).eq("id", r.id);
              drifts.push({ id: r.id, reason: "subscription_missing_in_stripe" });
              fixed++;
            } else {
              console.error("[addons-reconcile] error", r.id, msg);
            }
          }
        }

        // Best-effort: notifica admin se houve drift
        if (fixed > 0) {
          try {
            await sb.functions.invoke("emit-admin-event", {
              body: {
                event_key: "addon.reconciled",
                title: `Reconciliação de add-ons: ${fixed} ajuste(s)`,
                message: `${checked} contratos verificados, ${fixed} sincronizados com o Stripe.`,
                severity: fixed > 5 ? "warning" : "info",
                payload: { checked, fixed, drifts: drifts.slice(0, 20) },
              },
            });
          } catch {}
        }

        return Response.json({ ok: true, checked, fixed, drifts });
      },
    },
  },
});
