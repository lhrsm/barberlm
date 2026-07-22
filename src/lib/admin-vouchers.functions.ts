import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

/**
 * Fase 2 — Backend + Stripe do sistema de Voucher Administrativo Interno.
 *
 * Fluxo:
 *  1. createAdminVoucher: cria linha em `saas_admin_vouchers` (status=draft) e
 *     provisiona cupons no Stripe (sandbox + live quando possível) — 100% off
 *     forever.
 *  2. applyAdminVoucher: anexa o cupom à assinatura ativa do tenant no Stripe
 *     e cria uma `saas_admin_voucher_redemptions` (status=active). Também marca
 *     o voucher como active e o `profiles.is_internal_test_tenant = true`.
 *  3. revokeAdminVoucher: remove o cupom da assinatura, marca redemption/voucher
 *     como revoked e desliga o flag interno.
 *
 * Todas as operações exigem role super_admin e são auditadas em
 * `saas_admin_voucher_audit_logs`.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function assertSuperAdmin(sb: any, userId: string): Promise<Result<{}>> {
  const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Forbidden — super admin apenas" };
  return { ok: true };
}

async function audit(
  sb: any,
  args: {
    voucher_id?: string | null;
    redemption_id?: string | null;
    tenant_id?: string | null;
    action: string;
    actor_user_id: string;
    reason?: string;
    previous_values?: any;
    new_values?: any;
  },
) {
  try {
    await sb.from("saas_admin_voucher_audit_logs" as any).insert(args as any);
  } catch (e) {
    console.warn("[admin-vouchers] audit insert failed", args.action, e);
  }
}

async function tryCreateStripeCoupon(env: StripeEnv, name: string, discountPct: number, durationType: "forever" | "until_date", expiresAt?: string | null) {
  try {
    const stripe = createStripeClient(env);
    const coupon = await stripe.coupons.create({
      name: `[Barbex Interno] ${name}`,
      percent_off: discountPct,
      duration: "forever",
      metadata: {
        purpose: "internal_testing",
        source: "barbex_admin_voucher",
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      },
    });
    return { ok: true as const, couponId: coupon.id };
  } catch (e) {
    return { ok: false as const, error: getStripeErrorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export const createAdminVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    name: string;
    specificTenantId: string;
    specificBarbershopId?: string | null;
    allowedPlanId?: string | null;
    includesAllAddons?: boolean;
    allowedAddonIds?: string[];
    discountPercentage?: number;
    durationType?: "forever" | "until_date";
    expiresAt?: string | null;
    requiresPaymentMethod?: boolean;
  }) => data)
  .handler(async ({ data, context }): Promise<Result<{ voucherId: string }>> => {
    const { supabase: sb, userId } = context;
    const guard = await assertSuperAdmin(sb, userId);
    if (!guard.ok) return guard;

    const discount = data.discountPercentage ?? 100;
    const durationType = data.durationType ?? "forever";

    // 1) Cria linha draft
    const { data: inserted, error: insErr } = await sb
      .from("saas_admin_vouchers" as any)
      .insert({
        name: data.name,
        purpose: "internal_testing",
        specific_tenant_id: data.specificTenantId,
        specific_barbershop_id: data.specificBarbershopId ?? null,
        allowed_plan_id: data.allowedPlanId ?? null,
        includes_all_addons: data.includesAllAddons ?? true,
        allowed_addon_ids: data.allowedAddonIds ?? [],
        discount_percentage: discount,
        duration_type: durationType,
        expires_at: data.expiresAt ?? null,
        requires_payment_method: data.requiresPaymentMethod ?? false,
        status: "draft",
        created_by: userId,
      } as any)
      .select("id")
      .single();

    if (insErr || !inserted) {
      return { ok: false, error: insErr?.message || "Falha ao criar voucher" };
    }

    const voucherId = (inserted as any).id as string;

    // 2) Provisiona cupons Stripe (sandbox e live — o que falhar é apenas warning)
    const [sandboxRes, liveRes] = await Promise.all([
      tryCreateStripeCoupon("sandbox", data.name, discount, durationType, data.expiresAt ?? null),
      tryCreateStripeCoupon("live", data.name, discount, durationType, data.expiresAt ?? null),
    ]);

    const update: any = {};
    if (sandboxRes.ok) update.stripe_coupon_id_test = sandboxRes.couponId;
    if (liveRes.ok) update.stripe_coupon_id_live = liveRes.couponId;

    // Se ao menos um ambiente conseguiu, marcar como pending para aplicação.
    if (sandboxRes.ok || liveRes.ok) {
      update.status = "pending";
    } else {
      update.status = "failed";
    }

    await sb.from("saas_admin_vouchers" as any).update(update).eq("id", voucherId);

    await audit(sb, {
      voucher_id: voucherId,
      tenant_id: data.specificTenantId,
      action: "voucher.created",
      actor_user_id: userId,
      new_values: {
        name: data.name,
        discount,
        durationType,
        stripe_sandbox: sandboxRes.ok ? "ok" : sandboxRes.error,
        stripe_live: liveRes.ok ? "ok" : liveRes.error,
      },
    });

    if (!sandboxRes.ok && !liveRes.ok) {
      return { ok: false, error: `Voucher criado mas Stripe falhou: ${sandboxRes.error} / ${liveRes.error}` };
    }
    return { ok: true, voucherId };
  });

// ---------------------------------------------------------------------------
// APPLY
// ---------------------------------------------------------------------------
export const applyAdminVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { voucherId: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<Result<{ redemptionId: string }>> => {
    const { supabase: sb, userId } = context;
    const guard = await assertSuperAdmin(sb, userId);
    if (!guard.ok) return guard;

    // Carrega voucher
    const { data: voucher, error: vErr } = await sb
      .from("saas_admin_vouchers" as any)
      .select("*")
      .eq("id", data.voucherId)
      .maybeSingle();
    if (vErr || !voucher) return { ok: false, error: "Voucher não encontrado" };
    if ((voucher as any).status === "revoked") return { ok: false, error: "Voucher revogado" };

    const v = voucher as any;
    const couponId = data.environment === "live" ? v.stripe_coupon_id_live : v.stripe_coupon_id_test;
    if (!couponId) return { ok: false, error: `Cupom Stripe não configurado para ${data.environment}` };
    if (!v.specific_tenant_id) return { ok: false, error: "Voucher sem tenant vinculado" };

    // Busca assinatura ativa do tenant
    const { data: sub } = await sb
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id, product_id")
      .eq("user_id", v.specific_tenant_id)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Aplica cupom na assinatura, se houver
    let stripeSubId: string | null = null;
    let stripeCustomerId: string | null = null;
    if (sub?.stripe_subscription_id) {
      try {
        const stripe = createStripeClient(data.environment);
        await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
          discounts: [{ coupon: couponId }],
        } as any);
        stripeSubId = sub.stripe_subscription_id as string;
        stripeCustomerId = (sub.stripe_customer_id as string) ?? null;
      } catch (e) {
        return { ok: false, error: `Falha ao aplicar cupom no Stripe: ${getStripeErrorMessage(e)}` };
      }
    }

    // Cria redemption
    const { data: red, error: rErr } = await sb
      .from("saas_admin_voucher_redemptions" as any)
      .insert({
        voucher_id: v.id,
        tenant_id: v.specific_tenant_id,
        barbershop_id: v.specific_barbershop_id ?? null,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubId,
        applied_plan_id: v.allowed_plan_id ?? null,
        original_monthly_amount: 0,
        discount_amount: 0,
        final_monthly_amount: 0,
        status: "active",
        starts_at: new Date().toISOString(),
        ends_at: v.duration_type === "until_date" ? v.expires_at : null,
        applied_by: userId,
        metadata: { environment: data.environment },
      } as any)
      .select("id")
      .single();

    if (rErr || !red) return { ok: false, error: rErr?.message || "Falha ao registrar redemption" };

    // Marca voucher como active e liga flag interno no tenant
    await Promise.all([
      sb.from("saas_admin_vouchers" as any)
        .update({ status: "active", applied_by: userId, applied_at: new Date().toISOString() })
        .eq("id", v.id),
      sb.from("profiles")
        .update({ is_internal_test_tenant: true } as any)
        .eq("id", v.specific_tenant_id),
    ]);

    await audit(sb, {
      voucher_id: v.id,
      redemption_id: (red as any).id,
      tenant_id: v.specific_tenant_id,
      action: "voucher.applied",
      actor_user_id: userId,
      new_values: { environment: data.environment, stripe_subscription_id: stripeSubId },
    });

    return { ok: true, redemptionId: (red as any).id };
  });

// ---------------------------------------------------------------------------
// REVOKE
// ---------------------------------------------------------------------------
export const revokeAdminVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { voucherId: string; reason?: string }) => data)
  .handler(async ({ data, context }): Promise<Result<{}>> => {
    const { supabase: sb, userId } = context;
    const guard = await assertSuperAdmin(sb, userId);
    if (!guard.ok) return guard;

    const { data: voucher } = await sb
      .from("saas_admin_vouchers" as any)
      .select("*")
      .eq("id", data.voucherId)
      .maybeSingle();
    if (!voucher) return { ok: false, error: "Voucher não encontrado" };
    const v = voucher as any;

    // Redemptions ativas para desanexar cupom no Stripe
    const { data: reds } = await sb
      .from("saas_admin_voucher_redemptions" as any)
      .select("id, stripe_subscription_id, metadata")
      .eq("voucher_id", v.id)
      .in("status", ["active", "pending"]);

    for (const r of (reds as any[]) || []) {
      const env: StripeEnv = (r.metadata?.environment === "live" ? "live" : "sandbox");
      if (r.stripe_subscription_id) {
        try {
          const stripe = createStripeClient(env);
          await stripe.subscriptions.update(r.stripe_subscription_id, {
            discounts: [],
          } as any);
        } catch (e) {
          console.warn("[admin-vouchers] detach coupon failed", getStripeErrorMessage(e));
        }
      }
    }

    // Marca redemptions e voucher como revoked
    await Promise.all([
      sb.from("saas_admin_voucher_redemptions" as any)
        .update({
          status: "revoked",
          revoked_by: userId,
          revoked_at: new Date().toISOString(),
          revocation_reason: data.reason ?? null,
        })
        .eq("voucher_id", v.id)
        .in("status", ["active", "pending"]),
      sb.from("saas_admin_vouchers" as any)
        .update({
          status: "revoked",
          revoked_by: userId,
          revoked_at: new Date().toISOString(),
          revocation_reason: data.reason ?? null,
        })
        .eq("id", v.id),
    ]);

    // Desliga flag interno se não houver mais vouchers ativos para o tenant
    if (v.specific_tenant_id) {
      const { data: stillActive } = await sb
        .from("saas_admin_voucher_redemptions" as any)
        .select("id")
        .eq("tenant_id", v.specific_tenant_id)
        .eq("status", "active")
        .limit(1);
      if (!stillActive || stillActive.length === 0) {
        await sb.from("profiles")
          .update({ is_internal_test_tenant: false } as any)
          .eq("id", v.specific_tenant_id);
      }
    }

    await audit(sb, {
      voucher_id: v.id,
      tenant_id: v.specific_tenant_id,
      action: "voucher.revoked",
      actor_user_id: userId,
      reason: data.reason,
    });

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------
export const listAdminVouchers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<{ vouchers: any[] }>> => {
    const { supabase: sb, userId } = context;
    const guard = await assertSuperAdmin(sb, userId);
    if (!guard.ok) return guard;

    const { data, error } = await sb
      .from("saas_admin_vouchers" as any)
      .select("*, saas_admin_voucher_redemptions(id, status, tenant_id, applied_at)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return { ok: false, error: error.message };
    return { ok: true, vouchers: (data as any[]) || [] };
  });
