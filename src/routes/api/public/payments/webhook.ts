import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";
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

  // Sync add-ons items (se houver items de add-on nesta subscription)
  await syncAddonsFromSubscription(subscription, env);

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

async function syncAddonsFromSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;
  const items = subscription.items?.data ?? [];
  for (const item of items) {
    const price = item.price ?? {};
    const meta = price.metadata ?? {};
    const isAddon = meta.is_addon === "true" || (price.lookup_key ?? "").startsWith("addon_");
    if (!isAddon) continue;

    const addonKey = meta.addon_key ?? (price.lookup_key ?? "").replace(/^addon_/, "").replace(/_monthly$/, "");
    if (!addonKey) continue;

    const { data: addon } = await getSupabase().from("saas_addons")
      .select("id, monthly_price, currency").eq("addon_key", addonKey).maybeSingle();
    if (!addon) {
      console.warn("[Webhook] addon não encontrado no catálogo:", addonKey);
      continue;
    }

    const periodStart = item.current_period_start ?? subscription.current_period_start;
    const periodEnd = item.current_period_end ?? subscription.current_period_end;
    const itemCancel = (item.metadata?.cancel_at_period_end === "true") || subscription.cancel_at_period_end === true;
    const trialEnd = item.trial_end ?? subscription.trial_end ?? null;
    const isTrialing = subscription.status === "trialing" || (trialEnd && trialEnd * 1000 > Date.now());

    // Detecta transição trial → active para notificar
    const { data: prevContract } = await getSupabase().from("tenant_addons")
      .select("status, trial_used")
      .eq("stripe_subscription_item_id", item.id)
      .maybeSingle();

    await getSupabase().from("tenant_addons").upsert(
      {
        tenant_id: userId,
        addon_id: addon.id,
        environment: env,
        status: subscription.status,
        quantity: item.quantity ?? 1,
        unit_price: (price.unit_amount ?? 0) / 100 || Number(addon.monthly_price ?? 0),
        currency: (price.currency ?? addon.currency ?? "BRL").toUpperCase(),
        stripe_subscription_id: subscription.id,
        stripe_subscription_item_id: item.id,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: itemCancel,
        trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
        trial_used: isTrialing || prevContract?.trial_used || false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_item_id" }
    );

    // Trial → Active: dispara evento admin
    if (prevContract?.status === "trialing" && subscription.status === "active") {
      const profile = await loadProfileForUser(userId);
      await fireAdminEvent({
        event_key: "addon.trial_converted",
        title: "Trial de add-on convertido em pago",
        message: `${profile?.business_name ?? profile?.email ?? userId} — ${addonKey}`,
        severity: "info",
        tenant_id: userId,
        action_url: "/admin/addons",
        payload: { userId, addonKey, subscription_id: subscription.id },
      });
    }
  }
}

/**
 * Item 16/17: quando ocorre upgrade de plano, add-ons cujo module_key
 * agora esteja incluído no novo plano são absorvidos.
 * - Remove o subscription_item correspondente no Stripe (com proração)
 * - Marca tenant_addons como status='absorbed_by_plan' + access_source='plan'
 * - Mantém dados do módulo (produtos, configs) intactos
 */
async function absorbAddonsIntoPlan(args: {
  tenantId: string;
  subscriptionId: string;
  newPriceId: string | undefined;
  env: StripeEnv;
}) {
  const { tenantId, subscriptionId, newPriceId, env } = args;
  if (!newPriceId) return;

  const sb = getSupabase();

  // Buscar allowed_modules do novo plano
  const col = env === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
  const { data: newPlan } = await sb
    .from("plans")
    .select("id, name, allowed_modules")
    .or(`${col}.eq.${newPriceId},slug.eq.${newPriceId.replace(/_monthly$/, "")}`)
    .eq("active", true)
    .maybeSingle();

  const allowed: string[] = Array.isArray(newPlan?.allowed_modules)
    ? (newPlan!.allowed_modules as any[]).filter((v) => typeof v === "string")
    : [];
  if (allowed.length === 0) return;

  // Add-ons ativos deste tenant/subscription cujo module_key entra no novo plano
  const { data: contracts } = await sb
    .from("tenant_addons")
    .select("id, addon_id, stripe_subscription_item_id, saas_addons:addon_id(module_key, name, addon_key)")
    .eq("tenant_id", tenantId)
    .eq("stripe_subscription_id", subscriptionId)
    .in("status", ["active", "trialing", "past_due"]);

  const absorbCandidates = ((contracts as any[]) ?? []).filter(
    (c) => c?.saas_addons?.module_key && allowed.includes(c.saas_addons.module_key)
  );
  if (absorbCandidates.length === 0) return;

  const stripe = createStripeClient(env);
  for (const c of absorbCandidates) {
    const itemId = c.stripe_subscription_item_id;
    if (itemId) {
      try {
        await stripe.subscriptionItems.del(itemId, { proration_behavior: "create_prorations" } as any);
      } catch (err) {
        console.warn("[absorb] falha ao remover item Stripe", itemId, (err as Error).message);
      }
    }
    await sb
      .from("tenant_addons")
      .update({
        status: "absorbed_by_plan",
        access_source: "plan",
        stripe_subscription_item_id: null,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    await fireAdminEvent({
      event_key: "addon.absorbed_by_plan",
      title: "Add-on absorvido pelo novo plano",
      message: `${c.saas_addons?.name ?? c.saas_addons?.addon_key} — agora incluído no plano ${newPlan?.name ?? ""}`,
      severity: "info",
      tenant_id: tenantId,
      action_url: "/subscription",
      payload: { addon_id: c.addon_id, plan_id: newPlan?.id, module_key: c.saas_addons?.module_key },
    });
  }
}


async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const items = subscription.items?.data ?? [];
  // O item de plano é o primeiro que NÃO for add-on
  const planItem = items.find((it: any) => {
    const meta = it.price?.metadata ?? {};
    const isAddon = meta.is_addon === "true" || (it.price?.lookup_key ?? "").startsWith("addon_");
    return !isAddon;
  }) ?? items[0];
  const item = planItem;
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

  // Sync add-ons items
  await syncAddonsFromSubscription(subscription, env);

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

      // Item 16/17: absorver add-ons agora incluídos no novo plano
      if (isUpgrade) {
        try {
          await absorbAddonsIntoPlan({
            tenantId: userId,
            subscriptionId: subscription.id,
            newPriceId: priceId,
            env,
          });
        } catch (err) {
          console.error("[Webhook] absorbAddonsIntoPlan failed:", (err as Error).message);
        }
      }

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

  // Cancela todos os add-ons vinculados a essa subscription
  await getSupabase()
    .from("tenant_addons")
    .update({ status: "canceled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

function extractAddonItemIds(invoice: any): string[] {
  const lines = invoice?.lines?.data ?? [];
  const ids: string[] = [];
  for (const line of lines) {
    const itemId = line?.subscription_item ?? line?.parent?.subscription_item_details?.subscription_item;
    if (itemId) ids.push(itemId);
  }
  return Array.from(new Set(ids));
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

  // Reset dunning counters on any add-on item that just paid
  const itemIds = extractAddonItemIds(invoice);
  if (itemIds.length > 0) {
    await getSupabase()
      .from("tenant_addons")
      .update({
        payment_failed_count: 0,
        last_payment_error: null,
        last_payment_failed_at: null,
        updated_at: new Date().toISOString(),
      })
      .in("stripe_subscription_item_id", itemIds)
      .eq("environment", env)
      .gt("payment_failed_count", 0);
  }

  // 🛡️ High-value payment alert (>= R$ 500)
  const amountReais = (amountPaid ?? 0) / 100;
  if (amountReais >= 500 && userId) {
    const profile = await loadProfileForUser(userId);
    await fireAdminEvent({
      event_key: "payment.high_value",
      title: "Pagamento de alto valor recebido 💎",
      message: `${profile?.business_name ?? profile?.email ?? userId} — R$ ${amountReais.toFixed(2)}`,
      severity: "info",
      tenant_id: userId,
      action_url: "/admin/finance",
      payload: { userId, invoice_id: invoice.id, amount: amountReais, env },
    });
  }
}

async function handleInvoicePaymentFailed(invoice: any, env: StripeEnv) {
  const userId = invoice.subscription_details?.metadata?.userId || invoice.metadata?.userId;
  const amount = (invoice.amount_due ?? 0) / 100;
  const errorMsg =
    invoice?.last_finalization_error?.message ??
    invoice?.charge_details?.failure_message ??
    "Cobrança recusada";
  const attemptCount = invoice?.attempt_count ?? 1;
  console.log("[Webhook] ⚠️ Invoice payment failed:", { id: invoice.id, userId, amount, attemptCount });

  // Increment dunning counters on any affected add-on item
  const itemIds = extractAddonItemIds(invoice);
  if (itemIds.length > 0) {
    const { data: affected } = await getSupabase()
      .from("tenant_addons")
      .select("id, tenant_id, addon_id, payment_failed_count, saas_addons:addon_id(name)")
      .in("stripe_subscription_item_id", itemIds)
      .eq("environment", env);

    for (const row of (affected ?? []) as any[]) {
      const nextCount = (row.payment_failed_count ?? 0) + 1;
      await getSupabase()
        .from("tenant_addons")
        .update({
          payment_failed_count: nextCount,
          last_payment_error: errorMsg,
          last_payment_failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      const profile = row.tenant_id ? await loadProfileForUser(row.tenant_id) : null;
      const addonName = row.saas_addons?.name ?? "Módulo";
      await fireAdminEvent({
        event_key: "addon.payment_failed",
        title: `Falha no pagamento do módulo ${addonName}`,
        message: `${profile?.business_name ?? profile?.email ?? row.tenant_id} — tentativa ${nextCount} · R$ ${amount.toFixed(2)}`,
        severity: nextCount >= 3 ? "critical" : "warning",
        tenant_id: row.tenant_id,
        action_url: "/subscription",
        payload: {
          tenant_id: row.tenant_id,
          addon_id: row.addon_id,
          invoice_id: invoice.id,
          attempt: nextCount,
          amount,
          error: errorMsg,
          env,
        },
      });
    }
  }

  const profile = userId ? await loadProfileForUser(userId) : null;
  await fireAdminEvent({
    event_key: "subscription.payment_failed",
    title: "Falha no pagamento da assinatura",
    message: `${profile?.business_name ?? profile?.email ?? userId ?? "Cliente"} — R$ ${amount.toFixed(2)}`,
    severity: "critical",
    tenant_id: userId,
    action_url: "/admin/subscriptions",
    payload: { userId, invoice_id: invoice.id, amount, attempt: attemptCount, error: errorMsg, env },
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
    case "invoice.payment_failed":
      console.log("[Webhook] ⚠️ Processando invoice.payment_failed");
      await handleInvoicePaymentFailed(object, env);
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
