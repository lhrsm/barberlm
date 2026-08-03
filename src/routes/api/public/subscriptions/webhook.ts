import { createFileRoute } from "@tanstack/react-router";
import { getProvider } from "@/lib/payments/providers/index.server";
import { createClient } from "@supabase/supabase-js";
import type { PaymentGatewayRow, ProviderKey } from "@/lib/payments/types";
import { enforceRateLimit } from "@/lib/rate-limit.server";

/**
 * Webhook unificado para gateways de assinatura de clientes finais.
 * URL: /api/public/subscriptions/webhook?gateway=<gateway_id>
 *
 * Cada provider tem seu formato de payload — a URL identifica o gateway,
 * o provider correto é escolhido dinamicamente e o evento é normalizado.
 */
export const Route = createFileRoute("/api/public/subscriptions/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = await enforceRateLimit(request, "subs_webhook", { max: 120, windowSeconds: 60 });
        if (rl) return rl;
        const reqUrl = new URL(request.url);
        const gatewayId = reqUrl.searchParams.get("gateway");
        if (!gatewayId) return new Response("Missing gateway id", { status: 400 });
        
        const sbUrl = process.env.SUPABASE_URL;
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!sbUrl || !sbKey) return new Response("Missing env", { status: 500 });
        
        const supabaseAdmin = createClient(sbUrl, sbKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: gw, error: gwErr } = await supabaseAdmin
          .from("payment_gateways")
          .select("*")
          .eq("id", gatewayId)
          .maybeSingle();
        if (gwErr || !gw) return new Response("Gateway not found", { status: 404 });

        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => { headers[k] = v; });

        let payload: unknown = null;
        try { payload = await request.json(); } catch { payload = null; }

        const provider = await getProvider((gw as any).provider as ProviderKey);

        // Log bruto pra auditoria
        await supabaseAdmin.from("payment_gateway_logs").insert({
          tenant_id: (gw as any).tenant_id,
          gateway_id: (gw as any).id,
          event: "webhook_received",
          status: "info",
          message: `payload=${JSON.stringify(payload).slice(0, 500)}`,
        });

        if (!provider.parseWebhook) {
          return Response.json({ received: true, ignored: "no parser" });
        }

        try {
          const event = await provider.parseWebhook(
            payload,
            headers,
            gw as unknown as PaymentGatewayRow,
          );
          if (!event) return Response.json({ received: true, ignored: "no event" });

          // Atualiza subscription/payment pelo provider_subscription_id ou provider_payment_id
          let subRowForEvent: any = null;
          if (event.providerSubscriptionId) {
            const nextStatus = event.status === "paid" ? "active"
              : event.status === "canceled" ? "canceled"
              : event.status === "failed" ? "past_due"
              : "pending_payment";
            await supabaseAdmin
              .from("customer_subscriptions")
              .update({ status: nextStatus, updated_at: new Date().toISOString() })
              .eq("provider_subscription_id", event.providerSubscriptionId);

            const { data: subRow } = await supabaseAdmin
              .from("customer_subscriptions")
              .select("id, tenant_id, customer_id, plan_name, amount")
              .eq("provider_subscription_id", event.providerSubscriptionId)
              .maybeSingle();
            subRowForEvent = subRow;

            // Event-driven fan-out for subscription lifecycle
            if (subRow) {
              const evtMap: Record<string, string> = {
                paid: "subscription.renewed",
                canceled: "subscription.cancelled",
                failed: "subscription.renewal_failed",
              };
              const evtName = evtMap[event.status || ""];
              if (evtName) {
                supabaseAdmin.functions.invoke("emit-automation-event", {
                  body: {
                    tenant_id: (subRow as any).tenant_id,
                    event: evtName,
                    customer_id: (subRow as any).customer_id,
                    extra: {
                      plan_name: (subRow as any).plan_name || "",
                      subscription_name: (subRow as any).plan_name || "",
                    },
                  },
                }).catch((e) => console.warn("[SubWebhook] emit failed", e));
              }
            }
          }

          if (event.providerPaymentId) {
            // Registra pagamento se ainda não existe (idempotente por provider_payment_id)
            const { data: existing } = await supabaseAdmin
              .from("subscription_payments")
              .select("id")
              .eq("provider_payment_id", event.providerPaymentId)
              .maybeSingle();
            if (!existing && event.providerSubscriptionId) {
              const sub = subRowForEvent ?? (await supabaseAdmin
                .from("customer_subscriptions")
                .select("id, tenant_id, customer_id, amount, currency")
                .eq("provider_subscription_id", event.providerSubscriptionId)
                .maybeSingle()).data;
              if (sub) {
                await supabaseAdmin.from("subscription_payments").insert({
                  tenant_id: (sub as any).tenant_id,
                  subscription_id: (sub as any).id,
                  gateway_id: (gw as any).id,
                  provider: event.provider,
                  provider_payment_id: event.providerPaymentId,
                  status: event.status === "paid" ? "paid" : "pending",
                  amount: event.amount ?? Number((sub as any).amount ?? 0),
                  currency: event.currency ?? (sub as any).currency ?? "BRL",
                  paid_at: event.status === "paid" ? new Date().toISOString() : null,
                  raw_payload: (event.raw ?? {}) as any,
                });

                // Emit payment.confirmed on successful payment
                if (event.status === "paid") {
                  supabaseAdmin.functions.invoke("emit-automation-event", {
                    body: {
                      tenant_id: (sub as any).tenant_id,
                      event: "payment.confirmed",
                      customer_id: (sub as any).customer_id,
                      extra: {
                        amount: event.amount ?? Number((sub as any).amount ?? 0),
                        payment_method: event.provider || "",
                      },
                    },
                  }).catch((e) => console.warn("[SubWebhook] emit payment failed", e));
                }
              }
            }
          }

          return Response.json({ received: true, event: event.eventType });
        } catch (err: any) {
          await supabaseAdmin.from("payment_gateway_logs").insert({
            tenant_id: (gw as any).tenant_id,
            gateway_id: (gw as any).id,
            event: "webhook_error",
            status: "error",
            message: String(err?.message ?? err).slice(0, 500),
          });
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
