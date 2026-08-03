import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const priceIdField = (env: StripeEnv) =>
  env === "live" ? "stripe_price_id_live" : "stripe_price_id_test";

async function emitAdminEventServer(
  sb: any,
  args: {
    event_key: string;
    title: string;
    message?: string;
    severity?: "info" | "warning" | "critical";
    tenant_id?: string;
    payload?: Record<string, unknown>;
  },
) {
  try {
    await sb.functions.invoke("emit-admin-event", { body: args });
  } catch (e) {
    console.warn("[addons] emit admin event failed", args.event_key, e);
  }
}

async function tenantAlreadyUsedTrial(sb: any, tenantId: string, addonId: string): Promise<boolean> {
  const { data } = await sb.from("tenant_addons" as any)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId)
    .eq("trial_used", true)
    .limit(1)
    .maybeSingle();
  return !!data;
}


/**
 * previewAddon
 * Retorna preview de proration (valor a cobrar agora, próxima cobrança).
 */
export const previewAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    addonId: string;
    quantity?: number;
    environment: StripeEnv;
  }) => data)
  .handler(async ({ data, context }): Promise<Result<{
    prorationAmount: number;
    currency: string;
    nextInvoiceAmount: number;
    nextInvoiceDate: string | null;
    unitPrice: number;
    quantity: number;
    trialDays: number;
    trialEligible: boolean;
  }>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: addon } = await sb.from("saas_addons" as any)
        .select("*").eq("id", data.addonId).maybeSingle();
      if (!addon) return { ok: false, error: "Add-on não encontrado" };

      const priceId = (addon as any)[priceIdField(data.environment)];
      if (!priceId) return { ok: false, error: "Add-on ainda não configurado no Stripe" };

      const trialDays = Number((addon as any).trial_days ?? 0);
      const trialEligible = trialDays > 0 && !(await tenantAlreadyUsedTrial(sb, userId, data.addonId));

      const { data: sub } = await sb.from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .eq("user_id", userId).eq("environment", data.environment)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      const stripe = await createStripeClient(data.environment);
      const qty = Math.max(1, data.quantity ?? 1);

      if (!sub?.stripe_subscription_id) {
        const price = await stripe.prices.retrieve(priceId);
        const unit = (price.unit_amount ?? 0) / 100;
        return {
          ok: true,
          prorationAmount: trialEligible ? 0 : unit * qty,
          currency: price.currency ?? "brl",
          nextInvoiceAmount: unit * qty,
          nextInvoiceDate: null,
          unitPrice: unit,
          quantity: qty,
          trialDays,
          trialEligible,
        };
      }

      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
      const upcoming = await (stripe.invoices as any).createPreview({
        customer: subscription.customer as string,
        subscription: subscription.id,
        subscription_details: {
          items: [
            ...subscription.items.data.map((it: any) => ({ id: it.id, price: it.price.id, quantity: it.quantity })),
            { price: priceId, quantity: qty },
          ],
          proration_behavior: "create_prorations",
        },
      });

      const proration = (upcoming.lines?.data ?? [])
        .filter((l: any) => l.proration)
        .reduce((s: number, l: any) => s + (l.amount ?? 0), 0) / 100;

      return {
        ok: true,
        prorationAmount: trialEligible ? 0 : proration,
        currency: upcoming.currency ?? "brl",
        nextInvoiceAmount: (upcoming.amount_due ?? 0) / 100,
        nextInvoiceDate: upcoming.next_payment_attempt
          ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
          : (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
        unitPrice: Number((addon as any).monthly_price ?? 0),
        quantity: qty,
        trialDays,
        trialEligible,
      };
    } catch (e: any) {
      console.error("[previewAddon] error:", e.message);
      return { ok: false, error: e.message ?? "Erro ao calcular preview" };
    }
  });

/**
 * subscribeToAddon
 * Adiciona o add-on como novo subscription item à assinatura vigente do plano.
 * Se não houver assinatura ativa, retorna erro pedindo para assinar um plano antes.
 */
export const subscribeToAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    addonId: string;
    quantity?: number;
    environment: StripeEnv;
  }) => data)
  .handler(async ({ data, context }): Promise<Result<{ addonContractId: string }>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: addon } = await sb.from("saas_addons" as any)
        .select("*").eq("id", data.addonId).maybeSingle();
      if (!addon) return { ok: false, error: "Add-on não encontrado" };
      if (!(addon as any).is_active) return { ok: false, error: "Add-on desativado" };

      const priceId = (addon as any)[priceIdField(data.environment)];
      if (!priceId) {
        return { ok: false, error: "Este módulo ainda não está disponível para contratação. O administrador precisa configurá-lo no Stripe." };
      }

      // Já contratado?
      const { data: existing } = await sb.from("tenant_addons" as any)
        .select("id, status")
        .eq("tenant_id", userId)
        .eq("addon_id", data.addonId)
        .eq("environment", data.environment)
        .in("status", ["active", "trialing", "past_due"])
        .maybeSingle();
      if (existing) return { ok: false, error: "Você já contratou este módulo." };

      const { data: sub } = await sb.from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .eq("user_id", userId).eq("environment", data.environment)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (!sub?.stripe_subscription_id) {
        return { ok: false, error: "Você precisa ter uma assinatura ativa (Starter, Pro ou Elite) para contratar add-ons." };
      }

      const stripe = await createStripeClient(data.environment);
      const qty = Math.max(1, data.quantity ?? 1);

      const trialDays = Number((addon as any).trial_days ?? 0);
      const trialEligible = trialDays > 0 && !(await tenantAlreadyUsedTrial(sb, userId, data.addonId));

      const itemParams: any = {
        subscription: sub.stripe_subscription_id as string,
        price: priceId,
        quantity: qty,
        proration_behavior: trialEligible ? "none" : "create_prorations",
        metadata: {
          is_addon: "true",
          addon_id: data.addonId,
          addon_key: (addon as any).addon_key,
          userId,
          ...(trialEligible && { trial_ends_at: new Date(Date.now() + trialDays * 86400_000).toISOString() }),
        },
      };

      const item = await stripe.subscriptionItems.create(itemParams);

      const trialEndsAt = trialEligible
        ? new Date(Date.now() + trialDays * 86400_000).toISOString()
        : null;

      const { data: inserted, error: insErr } = await sb.from("tenant_addons" as any)
        .insert({
          tenant_id: userId,
          addon_id: data.addonId,
          environment: data.environment,
          status: trialEligible ? "trialing" : "active",
          quantity: qty,
          unit_price: Number((addon as any).monthly_price ?? 0),
          currency: (addon as any).currency ?? "BRL",
          stripe_subscription_id: sub.stripe_subscription_id,
          stripe_subscription_item_id: item.id,
          starts_at: new Date().toISOString(),
          trial_ends_at: trialEndsAt,
          trial_used: trialEligible,
          metadata: { added_via: "self_service", trial_at_signup: trialEligible },
        } as any)
        .select("id").single();

      if (insErr) throw insErr;

      // Fan-out admin event
      const addonName = (addon as any).name;
      const monthly = Number((addon as any).monthly_price ?? 0);
      if (trialEligible) {
        await emitAdminEventServer(sb, {
          event_key: "addon.trial_started",
          title: `Trial iniciado: ${addonName}`,
          message: `Cliente começou trial de ${trialDays} dias no add-on ${addonName}.`,
          severity: "info",
          tenant_id: userId,
          payload: { addon_id: data.addonId, addon_key: (addon as any).addon_key, trial_days: trialDays, trial_ends_at: trialEndsAt },
        });
      } else {
        await emitAdminEventServer(sb, {
          event_key: "addon.subscribed",
          title: `Novo contrato: ${addonName}`,
          message: `Cliente contratou o add-on ${addonName} (R$ ${monthly.toFixed(2)}/mês).`,
          severity: "info",
          tenant_id: userId,
          payload: { addon_id: data.addonId, addon_key: (addon as any).addon_key, monthly_price: monthly, quantity: qty },
        });
      }

      return { ok: true, addonContractId: (inserted as any).id };
    } catch (e: any) {
      console.error("[subscribeToAddon] error:", e.message);
      return { ok: false, error: e.message ?? "Erro ao contratar add-on" };
    }
  });

/**
 * cancelAddon
 * Marca cancel_at_period_end no subscription item (mantém acesso até fim do ciclo).
 */
export const cancelAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contractId: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<Result<{ endsAt: string | null }>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: contract } = await sb.from("tenant_addons" as any)
        .select("*").eq("id", data.contractId).eq("tenant_id", userId).maybeSingle();
      if (!contract) return { ok: false, error: "Contrato não encontrado" };

      const itemId = (contract as any).stripe_subscription_item_id;
      if (!itemId) return { ok: false, error: "Sem item no Stripe para cancelar" };

      const stripe = await createStripeClient(data.environment);
      // "Cancelar ao fim do ciclo" para um item = update com cancel_at_period_end via item metadata
      // Como a API do Stripe não tem cancel_at_period_end em items, usamos metadata + flag local.
      // Stripe efetiva o cancelamento via deletion agendada — simulamos com metadata + jobs.
      // Solução prática: apenas marcar flag local; ao final do período o webhook (invoice.paid do próximo ciclo)
      // dispara delete efetivo. Alternativa robusta: schedule via subscription schedules.
      // Aqui: marca localmente e agenda com pg_cron (fora do escopo desta função).
      await stripe.subscriptionItems.update(itemId, {
        metadata: {
          ...(contract as any).metadata,
          cancel_at_period_end: "true",
          cancelled_at: new Date().toISOString(),
        },
      });

      const { error } = await sb.from("tenant_addons" as any).update({
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
      }).eq("id", data.contractId);
      if (error) throw error;

      // Fan-out admin event
      const { data: addon } = await sb.from("saas_addons" as any)
        .select("name, addon_key, monthly_price")
        .eq("id", (contract as any).addon_id).maybeSingle();
      await emitAdminEventServer(sb, {
        event_key: "addon.canceled",
        title: `Add-on cancelado: ${(addon as any)?.name ?? "?"}`,
        message: `Cliente cancelou o add-on. Acesso mantido até o fim do ciclo atual.`,
        severity: "warning",
        tenant_id: userId,
        payload: {
          addon_id: (contract as any).addon_id,
          addon_key: (addon as any)?.addon_key,
          ends_at: (contract as any).current_period_end,
        },
      });

      return { ok: true, endsAt: (contract as any).current_period_end ?? null };
    } catch (e: any) {
      console.error("[cancelAddon] error:", e.message);
      return { ok: false, error: e.message ?? "Erro ao cancelar" };
    }
  });

/**
 * reactivateAddon
 * Desfaz um cancelamento agendado.
 */
export const reactivateAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contractId: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<Result<{ reactivated: boolean }>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: contract } = await sb.from("tenant_addons" as any)
        .select("*").eq("id", data.contractId).eq("tenant_id", userId).maybeSingle();
      if (!contract) return { ok: false, error: "Contrato não encontrado" };

      const itemId = (contract as any).stripe_subscription_item_id;
      if (itemId) {
        const stripe = await createStripeClient(data.environment);
        const meta = { ...(contract as any).metadata } as Record<string, any>;
        delete meta.cancel_at_period_end;
        delete meta.cancelled_at;
        await stripe.subscriptionItems.update(itemId, { metadata: meta });
      }

      const { error } = await sb.from("tenant_addons" as any).update({
        cancel_at_period_end: false,
        cancelled_at: null,
      }).eq("id", data.contractId);
      if (error) throw error;
      return { ok: true, reactivated: true };
    } catch (e: any) {
      return { ok: false, error: e.message ?? "Erro ao reativar" };
    }
  });

/**
 * updateAddonQuantity
 * Ajusta a quantidade de licenças/seats de um add-on ativo.
 * Aplica proration imediato no Stripe e sincroniza tenant_addons.
 */
export const updateAddonQuantity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contractId: string; quantity: number; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<Result<{ quantity: number }>> => {
    const { supabase: sb, userId } = context;
    try {
      const qty = Math.max(1, Math.floor(data.quantity));
      const { data: contract } = await sb.from("tenant_addons" as any)
        .select("id, quantity, status, stripe_subscription_item_id, addon_id, saas_addons:addon_id(name, addon_key)")
        .eq("id", data.contractId).eq("tenant_id", userId).maybeSingle();
      if (!contract) return { ok: false, error: "Contrato não encontrado" };
      if (!["active", "trialing", "past_due"].includes((contract as any).status)) {
        return { ok: false, error: "Só é possível ajustar quantidade em contratos ativos" };
      }
      if ((contract as any).quantity === qty) return { ok: true, quantity: qty };

      const itemId = (contract as any).stripe_subscription_item_id;
      if (itemId) {
        const stripe = await createStripeClient(data.environment);
        await stripe.subscriptionItems.update(itemId, {
          quantity: qty,
          proration_behavior: "create_prorations",
        });
      }

      const { error } = await sb.from("tenant_addons" as any)
        .update({ quantity: qty }).eq("id", data.contractId);
      if (error) throw error;

      const addonName = (contract as any).saas_addons?.name ?? "Add-on";
      await emitAdminEventServer(sb, {
        event_key: "addon.quantity_changed",
        title: `Quantidade alterada: ${addonName}`,
        message: `Cliente ajustou quantidade de ${(contract as any).quantity} para ${qty}.`,
        severity: "info",
        tenant_id: userId,
        payload: { addon_id: (contract as any).addon_id, from: (contract as any).quantity, to: qty },
      });

      return { ok: true, quantity: qty };
    } catch (e: any) {
      console.error("[updateAddonQuantity] error:", e.message);
      return { ok: false, error: e.message ?? "Erro ao ajustar quantidade" };
    }
  });

/**
 * adminCreateAddonStripePrice
 * Botão do admin: cria automaticamente Product+Price no Stripe para um add-on
 * que ainda não tem stripe_price_id_test/live configurado.
 */
export const adminCreateAddonStripePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { addonId: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<Result<{ priceId: string; productId: string }>> => {
    const { supabase: sb, userId } = context;
    try {
      // Verifica se é super admin
      const { data: isAdmin } = await sb.rpc("has_role" as any, { _user_id: userId, _role: "super_admin" as any });
      if (!isAdmin) return { ok: false, error: "Apenas super admins" };

      const { data: addon } = await sb.from("saas_addons" as any)
        .select("*").eq("id", data.addonId).maybeSingle();
      if (!addon) return { ok: false, error: "Add-on não encontrado" };

      const field = priceIdField(data.environment);
      if ((addon as any)[field]) {
        return { ok: false, error: `Price já existe (${data.environment}): ${(addon as any)[field]}` };
      }

      const stripe = await createStripeClient(data.environment);
      const productKey = `addon_${(addon as any).addon_key}`;
      const lookupKey = `${productKey}_monthly`;

      // Reutiliza Product se já existir (por metadata)
      const existingProducts = await stripe.products.search({
        query: `metadata['addon_key']:'${(addon as any).addon_key}'`,
        limit: 1,
      });
      const product = existingProducts.data.length
        ? existingProducts.data[0]
        : await stripe.products.create({
          name: `Add-on: ${(addon as any).name}`,
          description: (addon as any).description ?? undefined,
          metadata: { is_addon: "true", addon_key: (addon as any).addon_key, addon_id: data.addonId },
          tax_code: "txcd_10103001",
        });

      const price = await stripe.prices.create({
        product: product.id,
        currency: ((addon as any).currency ?? "brl").toLowerCase(),
        unit_amount: Math.round(Number((addon as any).monthly_price ?? 0) * 100),
        recurring: { interval: "month" },
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        metadata: { is_addon: "true", addon_key: (addon as any).addon_key, addon_id: data.addonId },
        nickname: `${(addon as any).name} — mensal`,
      });

      await sb.from("saas_addons" as any).update({ [field]: price.id }).eq("id", data.addonId);
      return { ok: true, priceId: price.id, productId: product.id };
    } catch (e: any) {
      console.error("[adminCreateAddonStripePrice] error:", e.message);
      return { ok: false, error: e.message ?? "Erro ao criar no Stripe" };
    }
  });

// ============================================================================
// Multi-item cross-plan purchase (Phase 3)
// ============================================================================

type BatchItemInput = {
  addonId: string;
  quantity?: number;
  billingCycle?: "monthly" | "annual";
};

/**
 * subscribeToAddonsBatch
 * Contrata múltiplos add-ons em uma única operação atômica no Stripe,
 * respeitando ciclo (monthly/annual) por item, proration imediato e
 * regra de `minimum_plan_id` (tier mínimo do plano do tenant).
 */
export const subscribeToAddonsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { items: BatchItemInput[]; environment: StripeEnv }) => {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("Nenhum item no carrinho");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Result<{
    contracts: Array<{ addonId: string; contractId: string; billingCycle: "monthly" | "annual" }>;
  }>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: sub } = await sb.from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id, price_id, environment")
        .eq("user_id", userId).eq("environment", data.environment)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!sub?.stripe_subscription_id) {
        return { ok: false, error: "Você precisa ter uma assinatura ativa para contratar add-ons." };
      }

      const priceCol = data.environment === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
      const { data: currentPlan } = await sb.from("plans")
        .select("id, tier").eq(priceCol, sub.price_id).maybeSingle();
      const currentTier = Number((currentPlan as any)?.tier ?? 0);
      const currentPlanId = (currentPlan as any)?.id ?? null;

      const addonIds = data.items.map((i) => i.addonId);
      const { data: addonsRows, error: addErr } = await sb.from("saas_addons" as any)
        .select("id, addon_key, name, monthly_price, annual_price, currency, is_active, minimum_plan_id, stripe_price_id_test, stripe_price_id_live")
        .in("id", addonIds);
      if (addErr || !addonsRows) return { ok: false, error: addErr?.message ?? "Add-ons não encontrados" };
      const addonMap = new Map((addonsRows as any[]).map((a) => [a.id, a]));

      const { data: existingRows } = await sb.from("tenant_addons" as any)
        .select("addon_id")
        .eq("tenant_id", userId)
        .eq("environment", data.environment)
        .in("addon_id", addonIds)
        .in("status", ["active", "trialing", "past_due"]);
      const dupSet = new Set(((existingRows as any[]) ?? []).map((r) => r.addon_id));

      const validated: Array<{
        addonId: string;
        addon: any;
        priceId: string;
        quantity: number;
        cycle: "monthly" | "annual";
      }> = [];
      const minPlanTiers = new Map<string, number>();

      for (const item of data.items) {
        const addon = addonMap.get(item.addonId);
        if (!addon) return { ok: false, error: `Add-on ${item.addonId} não encontrado` };
        if (!addon.is_active) return { ok: false, error: `Add-on "${addon.name}" desativado` };
        if (dupSet.has(item.addonId)) {
          return { ok: false, error: `Você já contratou "${addon.name}".` };
        }

        if (addon.minimum_plan_id) {
          let minTier = minPlanTiers.get(addon.minimum_plan_id);
          if (minTier === undefined) {
            const { data: mp } = await sb.from("plans")
              .select("tier").eq("id", addon.minimum_plan_id).maybeSingle();
            minTier = Number((mp as any)?.tier ?? 0);
            minPlanTiers.set(addon.minimum_plan_id, minTier);
          }
          if (currentTier < minTier) {
            return {
              ok: false,
              error: `O add-on "${addon.name}" requer um plano de tier ${minTier} ou superior. Faça upgrade do plano antes.`,
            };
          }
        }

        const priceId = (addon as any)[priceIdField(data.environment)];
        if (!priceId) {
          return {
            ok: false,
            error: `O add-on "${addon.name}" ainda não está disponível para contratação. Peça ao admin para configurá-lo no Stripe.`,
          };
        }

        validated.push({
          addonId: item.addonId,
          addon,
          priceId,
          quantity: Math.max(1, item.quantity ?? 1),
          cycle: item.billingCycle ?? "monthly",
        });
      }

      const stripe = await createStripeClient(data.environment);
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);

      const newItems = validated.map((v) => ({
        price: v.priceId,
        quantity: v.quantity,
        metadata: {
          is_addon: "true",
          addon_id: v.addonId,
          addon_key: v.addon.addon_key,
          billing_cycle: v.cycle,
          userId,
        },
      }));

      const updated = await stripe.subscriptions.update(subscription.id, {
        items: newItems,
        proration_behavior: "create_prorations",
      } as any);

      const itemsByAddon = new Map<string, string>();
      for (const it of (updated as any).items?.data ?? []) {
        const aid = it.metadata?.addon_id;
        if (it.metadata?.is_addon === "true" && aid) itemsByAddon.set(aid, it.id);
      }

      const contracts: Array<{ addonId: string; contractId: string; billingCycle: "monthly" | "annual" }> = [];
      for (const v of validated) {
        const unitPrice = v.cycle === "annual"
          ? Number(v.addon.annual_price ?? 0)
          : Number(v.addon.monthly_price ?? 0);

        const { data: inserted, error: insErr } = await sb.from("tenant_addons" as any)
          .insert({
            tenant_id: userId,
            addon_id: v.addonId,
            environment: data.environment,
            status: "active",
            quantity: v.quantity,
            billing_cycle: v.cycle,
            access_source: "addon",
            unit_price: unitPrice,
            currency: v.addon.currency ?? "BRL",
            stripe_subscription_id: sub.stripe_subscription_id,
            stripe_subscription_item_id: itemsByAddon.get(v.addonId) ?? null,
            starts_at: new Date().toISOString(),
            metadata: { added_via: "batch_checkout", plan_at_purchase: currentPlanId },
          } as any)
          .select("id").single();
        if (insErr) throw insErr;

        contracts.push({
          addonId: v.addonId,
          contractId: (inserted as any).id,
          billingCycle: v.cycle,
        });

        await emitAdminEventServer(sb, {
          event_key: "addon.subscribed",
          title: `Novo contrato: ${v.addon.name}`,
          message: `Cliente contratou add-on ${v.addon.name} (${v.cycle}, qtd ${v.quantity}).`,
          severity: "info",
          tenant_id: userId,
          payload: {
            addon_id: v.addonId,
            addon_key: v.addon.addon_key,
            billing_cycle: v.cycle,
            quantity: v.quantity,
            unit_price: unitPrice,
            source: "batch",
          },
        });
      }

      return { ok: true, contracts };
    } catch (e: any) {
      console.error("[subscribeToAddonsBatch] error:", e.message);
      return { ok: false, error: e.message ?? "Erro ao contratar add-ons" };
    }
  });

/**
 * previewAddonsBatch
 * Preview de proration para múltiplos add-ons de uma vez.
 */
export const previewAddonsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { items: BatchItemInput[]; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<Result<{
    prorationAmount: number;
    nextInvoiceAmount: number;
    currency: string;
    nextInvoiceDate: string | null;
  }>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: sub } = await sb.from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId).eq("environment", data.environment)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!sub?.stripe_subscription_id) {
        return { ok: false, error: "Sem assinatura ativa" };
      }

      const addonIds = data.items.map((i) => i.addonId);
      const { data: addons } = await sb.from("saas_addons" as any)
        .select("id, stripe_price_id_test, stripe_price_id_live")
        .in("id", addonIds);
      const map = new Map((addons as any[] ?? []).map((a) => [a.id, a]));

      const priceItems = data.items.map((it) => {
        const a: any = map.get(it.addonId);
        const priceId = a?.[priceIdField(data.environment)];
        return priceId
          ? { price: priceId, quantity: Math.max(1, it.quantity ?? 1) }
          : null;
      }).filter(Boolean) as Array<{ price: string; quantity: number }>;

      if (priceItems.length === 0) {
        return { ok: false, error: "Nenhum add-on configurado no Stripe" };
      }

      const stripe = await createStripeClient(data.environment);
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
      const upcoming = await (stripe.invoices as any).createPreview({
        customer: subscription.customer as string,
        subscription: subscription.id,
        subscription_details: {
          items: [
            ...subscription.items.data.map((it: any) => ({ id: it.id, price: it.price.id, quantity: it.quantity })),
            ...priceItems,
          ],
          proration_behavior: "create_prorations",
        },
      });

      const proration = (upcoming.lines?.data ?? [])
        .filter((l: any) => l.proration)
        .reduce((s: number, l: any) => s + (l.amount ?? 0), 0) / 100;

      return {
        ok: true,
        prorationAmount: proration,
        nextInvoiceAmount: (upcoming.amount_due ?? 0) / 100,
        currency: upcoming.currency ?? "brl",
        nextInvoiceDate: upcoming.next_payment_attempt
          ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
          : null,
      };
    } catch (e: any) {
      console.error("[previewAddonsBatch] error:", e.message);
      return { ok: false, error: e.message ?? "Erro no preview" };
    }
  });
