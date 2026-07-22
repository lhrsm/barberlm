import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const priceIdField = (env: StripeEnv) =>
  env === "live" ? "stripe_price_id_live" : "stripe_price_id_test";

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
  }>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: addon } = await sb.from("saas_addons" as any)
        .select("*").eq("id", data.addonId).maybeSingle();
      if (!addon) return { ok: false, error: "Add-on não encontrado" };

      const priceId = (addon as any)[priceIdField(data.environment)];
      if (!priceId) return { ok: false, error: "Add-on ainda não configurado no Stripe" };

      const { data: sub } = await sb.from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .eq("user_id", userId).eq("environment", data.environment)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      const stripe = createStripeClient(data.environment);
      const qty = Math.max(1, data.quantity ?? 1);

      if (!sub?.stripe_subscription_id) {
        // Sem subscription ativa: mostra apenas preço cheio
        const price = await stripe.prices.retrieve(priceId);
        const unit = (price.unit_amount ?? 0) / 100;
        return {
          ok: true,
          prorationAmount: unit * qty,
          currency: price.currency ?? "brl",
          nextInvoiceAmount: unit * qty,
          nextInvoiceDate: null,
          unitPrice: unit,
          quantity: qty,
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
        prorationAmount: proration,
        currency: upcoming.currency ?? "brl",
        nextInvoiceAmount: (upcoming.amount_due ?? 0) / 100,
        nextInvoiceDate: upcoming.next_payment_attempt
          ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
          : (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
        unitPrice: Number((addon as any).monthly_price ?? 0),
        quantity: qty,
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

      const stripe = createStripeClient(data.environment);
      const qty = Math.max(1, data.quantity ?? 1);

      const item = await stripe.subscriptionItems.create({
        subscription: sub.stripe_subscription_id as string,
        price: priceId,
        quantity: qty,
        proration_behavior: "create_prorations",
        metadata: {
          is_addon: "true",
          addon_id: data.addonId,
          addon_key: (addon as any).addon_key,
          userId,
        },
      });

      // Insert row local (webhook completará current_period_*)
      const { data: inserted, error: insErr } = await sb.from("tenant_addons" as any)
        .insert({
          tenant_id: userId,
          addon_id: data.addonId,
          environment: data.environment,
          status: "active",
          quantity: qty,
          unit_price: Number((addon as any).monthly_price ?? 0),
          currency: (addon as any).currency ?? "BRL",
          stripe_subscription_id: sub.stripe_subscription_id,
          stripe_subscription_item_id: item.id,
          starts_at: new Date().toISOString(),
          metadata: { added_via: "self_service" },
        } as any)
        .select("id").single();

      if (insErr) throw insErr;
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

      const stripe = createStripeClient(data.environment);
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
  .handler(async ({ data, context }): Promise<Result<Record<string, never>>> => {
    const { supabase: sb, userId } = context;
    try {
      const { data: contract } = await sb.from("tenant_addons" as any)
        .select("*").eq("id", data.contractId).eq("tenant_id", userId).maybeSingle();
      if (!contract) return { ok: false, error: "Contrato não encontrado" };

      const itemId = (contract as any).stripe_subscription_item_id;
      if (itemId) {
        const stripe = createStripeClient(data.environment);
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
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message ?? "Erro ao reativar" };
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

      const stripe = createStripeClient(data.environment);
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
