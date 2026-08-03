import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

/**
 * Structured error shape returned to the client so the UI can render
 * a rich "Falha ao criar Voucher" modal (stage, message, code, source, details).
 */
export type StructuredError = {
  stage: string;
  source: "supabase" | "stripe" | "validation" | "auth" | "unknown";
  message: string;
  code?: string | null;
  details?: any;
};

type Result<T> = ({ ok: true } & T) | { ok: false; error: string; errorDetails?: StructuredError };

function extractUnknownError(e: unknown, stage: string, source: StructuredError["source"] = "unknown"): StructuredError {
  const anyE = e as any;
  const message = anyE?.message || (typeof e === "string" ? e : "Erro desconhecido");
  return {
    stage,
    source,
    message,
    code: anyE?.code || anyE?.name || null,
    details: {
      name: anyE?.name,
      stack: anyE?.stack,
      cause: anyE?.cause,
      status: anyE?.status,
    },
  };
}

function extractStripeError(e: unknown, stage: string): StructuredError {
  const anyE = e as any;
  const raw = anyE?.raw ?? {};
  return {
    stage,
    source: "stripe",
    message: raw.message || anyE?.message || "Stripe request failed",
    code: raw.code || anyE?.code || anyE?.type || null,
    details: {
      type: raw.type || anyE?.type,
      code: raw.code || anyE?.code,
      decline_code: raw.decline_code,
      param: raw.param,
      requestId: anyE?.requestId || raw.requestId,
      statusCode: anyE?.statusCode,
      doc_url: raw.doc_url,
    },
  };
}

function extractSupabaseError(err: any, stage: string): StructuredError {
  return {
    stage,
    source: "supabase",
    message: err?.message || "Supabase request failed",
    code: err?.code || null,
    details: {
      hint: err?.hint,
      details: err?.details,
      status: err?.status,
    },
  };
}

function toErrString(se: StructuredError): string {
  const bits = [`[${se.stage}]`, se.source ? `(${se.source})` : "", se.message];
  if (se.code) bits.push(`— code: ${se.code}`);
  return bits.filter(Boolean).join(" ");
}

async function assertSuperAdmin(sb: any, userId: string): Promise<Result<{}>> {
  console.log("[Voucher] Verificando permissão super_admin", { userId });
  const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (error) {
    const se = extractSupabaseError(error, "assertSuperAdmin");
    console.error("[Voucher] Falha ao checar role", se);
    return { ok: false, error: toErrString(se), errorDetails: se };
  }
  if (!data) {
    const se: StructuredError = {
      stage: "assertSuperAdmin",
      source: "auth",
      message: "Forbidden — super admin apenas",
      code: "forbidden",
    };
    return { ok: false, error: toErrString(se), errorDetails: se };
  }
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
    console.warn("[Voucher] audit insert failed", args.action, e);
  }
}

async function getAdminClient(stage: string): Promise<Result<{ sb: any }>> {
  try {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    return { ok: true, sb: admin };
  } catch (e) {
    const se = extractUnknownError(e, stage, "supabase");
    console.error("[Voucher] Falha ao carregar cliente administrativo", se);
    return { ok: false, error: toErrString(se), errorDetails: se };
  }
}

async function tryCreateStripeCoupon(
  env: StripeEnv,
  name: string,
  discountPct: number,
  _durationType: "forever" | "until_date",
  expiresAt?: string | null,
) {
  console.log("[Voucher] Criando Coupon Stripe", { env, name, discountPct });
  try {
    const { createStripeClient } = await import("@/lib/stripe.server");
    const stripe = await createStripeClient(env);
    const coupon = await stripe.coupons.create({
      name: `[Barbex] ${name}`.slice(0, 40),
      percent_off: discountPct,
      duration: "forever",
      metadata: {
        purpose: "internal_testing",
        source: "barbex_admin_voucher",
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      },
    });
    console.log("[Voucher] Coupon criado", { env, couponId: coupon.id });
    return { ok: true as const, couponId: coupon.id };
  } catch (e) {
    const se = extractStripeError(e, `stripe.coupons.create[${env}]`);
    console.error("[Voucher] Falha Stripe", se);
    return { ok: false as const, error: se };
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
  .handler(async ({ data, context }): Promise<Result<{ voucherId: string; warnings?: string[] }>> => {
    const { supabase: authSb, userId } = context;

    console.log("[Voucher] Iniciando criação", {
      actor: userId,
      payload: {
        name: data.name,
        specificTenantId: data.specificTenantId,
        durationType: data.durationType,
        expiresAt: data.expiresAt,
        discountPercentage: data.discountPercentage,
      },
    });

    // 0) Auth
    const guard = await assertSuperAdmin(authSb, userId);
    if (!guard.ok) return guard;

    const admin = await getAdminClient("supabase.admin.create");
    if (!admin.ok) return admin;
    const sb = admin.sb;

    // 1) Validação
    if (!data.name?.trim()) {
      const se: StructuredError = { stage: "validate", source: "validation", message: "Nome é obrigatório", code: "name_required" };
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
    if (!data.specificTenantId) {
      const se: StructuredError = { stage: "validate", source: "validation", message: "Tenant é obrigatório", code: "tenant_required" };
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
    const discount = data.discountPercentage ?? 100;
    const durationType = data.durationType ?? "forever";
    if (discount <= 0 || discount > 100) {
      const se: StructuredError = { stage: "validate", source: "validation", message: "Desconto deve estar entre 1 e 100", code: "invalid_discount" };
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
    console.log("[Voucher] Validação concluída");

    // 2) Cria linha draft
    console.log("[Voucher] Criando registro no Supabase");
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
      const se = extractSupabaseError(insErr || { message: "Insert retornou vazio" }, "supabase.insert.saas_admin_vouchers");
      console.error("[Voucher] Falha ao inserir voucher", se);
      return { ok: false, error: toErrString(se), errorDetails: se };
    }

    const voucherId = (inserted as any).id as string;
    console.log("[Voucher] Registro criado", { voucherId });

    // 3) Provisiona cupons Stripe (sandbox e live). Se AMBOS falharem => erro fatal.
    console.log("[Voucher] Criando cupons Stripe (sandbox + live)");
    const [sandboxRes, liveRes] = await Promise.all([
      tryCreateStripeCoupon("sandbox", data.name, discount, durationType, data.expiresAt ?? null),
      tryCreateStripeCoupon("live", data.name, discount, durationType, data.expiresAt ?? null),
    ]);

    const update: any = {};
    const warnings: string[] = [];
    if (sandboxRes.ok) update.stripe_coupon_id_test = sandboxRes.couponId;
    else warnings.push(`Sandbox: ${sandboxRes.error.message}`);
    if (liveRes.ok) update.stripe_coupon_id_live = liveRes.couponId;
    else warnings.push(`Live: ${liveRes.error.message}`);

    if (sandboxRes.ok || liveRes.ok) update.status = "pending";
    else update.status = "failed";

    const { error: updErr } = await sb.from("saas_admin_vouchers" as any).update(update).eq("id", voucherId);
    if (updErr) {
      const se = extractSupabaseError(updErr, "supabase.update.saas_admin_vouchers");
      console.error("[Voucher] Falha ao atualizar voucher com cupons", se);
      return { ok: false, error: toErrString(se), errorDetails: se };
    }

    await audit(sb, {
      voucher_id: voucherId,
      tenant_id: data.specificTenantId,
      action: "voucher.created",
      actor_user_id: userId,
      new_values: {
        name: data.name,
        discount,
        durationType,
        stripe_sandbox: sandboxRes.ok ? { ok: true, couponId: sandboxRes.couponId } : { ok: false, error: sandboxRes.error },
        stripe_live: liveRes.ok ? { ok: true, couponId: liveRes.couponId } : { ok: false, error: liveRes.error },
      },
    });

    if (!sandboxRes.ok && !liveRes.ok) {
      const se: StructuredError = {
        stage: "stripe.coupons.create",
        source: "stripe",
        message: `Ambos os ambientes Stripe falharam. Sandbox: ${sandboxRes.error.message} | Live: ${liveRes.error.message}`,
        code: sandboxRes.error.code || liveRes.error.code || "stripe_both_failed",
        details: { sandbox: sandboxRes.error, live: liveRes.error, voucherId },
      };
      console.error("[Voucher] Falha total Stripe", se);
      return { ok: false, error: toErrString(se), errorDetails: se };
    }

    console.log("[Voucher] Finalizando com sucesso", { voucherId, warnings });
    return { ok: true, voucherId, warnings: warnings.length ? warnings : undefined };
  });

// ---------------------------------------------------------------------------
// APPLY
// ---------------------------------------------------------------------------
export const applyAdminVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { voucherId: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<Result<{ redemptionId: string }>> => {
    const { supabase: authSb, userId } = context;
    const guard = await assertSuperAdmin(authSb, userId);
    if (!guard.ok) return guard;

    const admin = await getAdminClient("supabase.admin.apply");
    if (!admin.ok) return admin;
    const sb = admin.sb;

    // Carrega voucher
    const { data: voucher, error: vErr } = await sb
      .from("saas_admin_vouchers" as any)
      .select("*")
      .eq("id", data.voucherId)
      .maybeSingle();
    if (vErr) {
      const se = extractSupabaseError(vErr, "supabase.select.saas_admin_vouchers.apply");
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
    if (!voucher) {
      const se: StructuredError = { stage: "supabase.select.saas_admin_vouchers.apply", source: "supabase", message: "Voucher não encontrado", code: "not_found" };
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
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
        const { createStripeClient } = await import("@/lib/stripe.server");
        const stripe = await createStripeClient(data.environment);
        await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
          discounts: [{ coupon: couponId }],
        } as any);
        stripeSubId = sub.stripe_subscription_id as string;
        stripeCustomerId = (sub.stripe_customer_id as string) ?? null;
      } catch (e) {
        const se = extractStripeError(e, `stripe.subscriptions.update[${data.environment}]`);
        return { ok: false, error: toErrString(se), errorDetails: se };
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

    if (rErr || !red) {
      const se = extractSupabaseError(rErr || { message: "Insert de aplicação retornou vazio" }, "supabase.insert.saas_admin_voucher_redemptions");
      return { ok: false, error: toErrString(se), errorDetails: se };
    }

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
    const { supabase: authSb, userId } = context;
    const guard = await assertSuperAdmin(authSb, userId);
    if (!guard.ok) return guard;

    const admin = await getAdminClient("supabase.admin.revoke");
    if (!admin.ok) return admin;
    const sb = admin.sb;

    const { data: voucher } = await sb
      .from("saas_admin_vouchers" as any)
      .select("*")
      .eq("id", data.voucherId)
      .maybeSingle();
    if (!voucher) {
      const se: StructuredError = { stage: "supabase.select.saas_admin_vouchers.revoke", source: "supabase", message: "Voucher não encontrado", code: "not_found" };
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
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
          const { createStripeClient } = await import("@/lib/stripe.server");
          const stripe = await createStripeClient(env);
          await stripe.subscriptions.update(r.stripe_subscription_id, {
            discounts: [],
          } as any);
        } catch (e) {
          console.warn("[Voucher] detach coupon failed", extractStripeError(e, "stripe.subscriptions.update.detach"));
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
    const { supabase: authSb, userId } = context;
    const guard = await assertSuperAdmin(authSb, userId);
    if (!guard.ok) return guard;

    const admin = await getAdminClient("supabase.admin.list");
    if (!admin.ok) return admin;
    const sb = admin.sb;

    const { data, error } = await sb
      .from("saas_admin_vouchers" as any)
      .select("*, saas_admin_voucher_redemptions(id, status, tenant_id, applied_at)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      const se = extractSupabaseError(error, "supabase.select.saas_admin_vouchers.list");
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
    return { ok: true, vouchers: (data as any[]) || [] };
  });

// ---------------------------------------------------------------------------
// AUDIT LOGS (Fase 5 — telemetria)
// ---------------------------------------------------------------------------
export const listAdminVoucherAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { voucherId?: string; tenantId?: string; limit?: number }) => data)
  .handler(async ({ data, context }): Promise<Result<{ logs: any[] }>> => {
    const { supabase: authSb, userId } = context;
    const guard = await assertSuperAdmin(authSb, userId);
    if (!guard.ok) return guard;

    const admin = await getAdminClient("supabase.admin.auditLogs");
    if (!admin.ok) return admin;
    const sb = admin.sb;

    let q = sb
      .from("saas_admin_voucher_audit_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));

    if (data.voucherId) q = q.eq("voucher_id", data.voucherId);
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);

    const { data: rows, error } = await q;
    if (error) {
      const se = extractSupabaseError(error, "supabase.select.saas_admin_voucher_audit_logs");
      return { ok: false, error: toErrString(se), errorDetails: se };
    }
    return { ok: true, logs: (rows as any[]) || [] };
  });
