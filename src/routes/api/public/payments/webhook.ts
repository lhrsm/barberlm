import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

const PRICE_TO_PLAN: Record<string, string> = {
  // Lookup keys
  starter_monthly: "starter",
  pro_monthly: "pro",
  elite_monthly: "elite",
  // Real IDs (LIVE)
  price_1TVtOWPKG6q10UjrQErPgyKO: "starter", // Starter LIVE
  price_1TVtOVPKG6q10Ujre6zMGYpk: "pro",     // Pro LIVE
  price_1TVtgWPKG6q10UjrxRUCnyg1: "elite",   // Elite LIVE (com lookup key)
  price_1TVsefPKG6q10UjrKpTaUe71: "elite",   // Elite LIVE (sem lookup key)
};

async function syncProfilePlan(userId: string, priceId: string | undefined, status: string) {
  if (!userId) return;
  const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
  const isActive = ["active", "trialing", "past_due"].includes(status);
  const newPlan = isActive && plan ? plan : "free";
  await getSupabase().from("profiles").update({ plan: newPlan }).eq("id", userId);
}

async function fireAdminEvent(args: {
  event_key: string;
  title: string;
  message?: string;
  severity?: "info" | "warning" | "critical";
  tenant_id?: string;
  action_url?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await getSupabase().functions.invoke("emit-admin-event", { body: args });
  } catch (e) {
    console.warn("[Webhook] admin event failed:", args.event_key, (e as Error).message);
  }
}

async function loadProfileForUser(userId: string) {
  const { data } = await getSupabase()
    .from("profiles")
    .select("id, business_name, full_name, email, plan")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  await syncProfilePlan(userId, priceId, subscription.status);

  // 🛡️ Notify super admins
  const profile = await loadProfileForUser(userId);
  const planLabel = priceId ? (PRICE_TO_PLAN[priceId] ?? priceId) : "desconhecido";
  await fireAdminEvent({
    event_key: "subscription.created",
    title: "Nova assinatura paga",
    message: `${profile?.business_name ?? profile?.email ?? userId} assinou o plano ${planLabel}`,
    severity: "info",
    tenant_id: userId,
    action_url: "/admin/subscriptions",
    payload: { userId, priceId, subscription_id: subscription.id, env },
  });
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;

  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase()
    .from("subscriptions")
    .update({
      status: subscription.status,
      product_id: productId,
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const userId = subscription.metadata?.userId;
  if (userId) {
    await syncProfilePlan(userId, priceId, subscription.status);

    // 🛡️ Detect upgrade/downgrade by comparing stored price
    const { data: prev } = await getSupabase()
      .from("subscriptions")
      .select("price_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    const rank: Record<string, number> = { starter_monthly: 1, starter: 1, pro_monthly: 2, pro: 2, elite_monthly: 3, elite: 3 };
    const oldRank = prev?.price_id ? (rank[prev.price_id] ?? 0) : 0;
    const newRank = priceId ? (rank[priceId] ?? 0) : 0;
    if (oldRank && newRank && newRank !== oldRank) {
      const profile = await loadProfileForUser(userId);
      const isUpgrade = newRank > oldRank;
      await fireAdminEvent({
        event_key: isUpgrade ? "subscription.upgraded" : "subscription.downgraded",
        title: isUpgrade ? "Upgrade de plano" : "Downgrade de plano",
        message: `${profile?.business_name ?? profile?.email ?? userId}: ${prev?.price_id} → ${priceId}`,
        severity: isUpgrade ? "info" : "warning",
        tenant_id: userId,
        action_url: "/admin/subscriptions",
        payload: { userId, old_price: prev?.price_id, new_price: priceId },
      });
    }
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const userId = subscription.metadata?.userId;
  if (userId) {
    await syncProfilePlan(userId, undefined, "canceled");
    const profile = await loadProfileForUser(userId);
    await fireAdminEvent({
      event_key: "subscription.cancelled",
      title: "Assinatura cancelada",
      message: `${profile?.business_name ?? profile?.email ?? userId} cancelou a assinatura`,
      severity: "warning",
      tenant_id: userId,
      action_url: "/admin/subscriptions",
      payload: { userId, subscription_id: subscription.id },
    });
  }
}

async function handleCheckoutSessionCompleted(session: any, env: StripeEnv) {
  const userId = session.metadata?.userId;
  const customerId = session.customer;
  const status = session.status;
  const paymentStatus = session.payment_status;

  console.log("[Webhook] ✅ Checkout Session Completed:", {
    sessionId: session.id,
    userId,
    customerId,
    status,
    paymentStatus,
    livemode: session.livemode,
    environment: env
  });

  // Se o pagamento já estiver concluído, podemos registrar algo se necessário.
  // Mas o Stripe geralmente dispara invoice.paid e subscription.created depois.
}

async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  const userId = invoice.subscription_details?.metadata?.userId || invoice.metadata?.userId;
  const subscriptionId = invoice.subscription;
  const amountPaid = invoice.amount_paid;
  const customerId = invoice.customer;

  console.log("[Webhook] 💰 Invoice Paid:", {
    invoiceId: invoice.id,
    subscriptionId,
    userId,
    customerId,
    amount: amountPaid / 100,
    environment: env
  });
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  console.log(`[Webhook] 📥 Evento recebido: ${event.type} (${env})`, {
    id: event.id,
    livemode: event.livemode
  });

  const object = event.data.object;

  switch (event.type) {
    case "customer.subscription.created":
      console.log("[Webhook] 🟢 Processando subscription.created");
      await handleSubscriptionCreated(object, env);
      break;
    case "customer.subscription.updated":
      console.log("[Webhook] 🟡 Processando subscription.updated");
      await handleSubscriptionUpdated(object, env);
      break;
    case "customer.subscription.deleted":
      console.log("[Webhook] 🔴 Processando subscription.deleted");
      await handleSubscriptionDeleted(object, env);
      break;
    case "checkout.session.completed":
      console.log("[Webhook] 🏁 Processando checkout.session.completed");
      await handleCheckoutSessionCompleted(object, env);
      break;
    case "invoice.paid":
      console.log("[Webhook] 💸 Processando invoice.paid");
      await handleInvoicePaid(object, env);
      break;
    default:
      console.log("[Webhook] ⚪ Evento não tratado explicitamente:", event.type);
  }
}


export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = await enforceRateLimit(request, "stripe_webhook", { max: 120, windowSeconds: 60 });
        if (rl) return rl;
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
