import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VoucherInfo = {
  id: string;
  name: string;
  purpose: string;
  duration_type: "forever" | "fixed" | string;
  starts_at: string | null;
  expires_at: string | null;
  discount_percentage: number;
  includes_all_addons: boolean;
  requires_payment_method: boolean;
  applied_at: string | null;
};

export type BillingContext = {
  tenant_id: string;
  tenant_name: string | null;
  tenant_email: string | null;
  plan_slug: string | null;
  plan_name: string | null;
  stripe_subscription_status: string | null;
  stripe_subscription_id: string | null;
  billing_status:
    | "active_paid"
    | "trialing"
    | "past_due"
    | "cancelled"
    | "voucher_active"
    | "voucher_revoked"
    | "internal_testing";
  billing_source: "stripe" | "voucher" | "trial" | "manual" | "partner";
  is_internal_test_tenant: boolean;
  has_active_voucher: boolean;
  voucher: VoucherInfo | null;
  original_monthly_amount: number;
  addons_monthly_amount: number;
  discount_amount: number;
  final_monthly_amount: number;
  requires_payment_method: boolean;
};

/**
 * Retorna o contexto comercial consolidado do tenant autenticado
 * (plano, valores, voucher permanente, status técnico vs comercial).
 */
export const getMyBillingContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingContext | { error: string }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("resolve_tenant_billing_context" as any, {
      _tenant_id: userId,
    });
    if (error) {
      console.error("[billing-context] rpc error", error);
      return { error: error.message };
    }
    return data as BillingContext;
  });

/**
 * Versão para o Super Admin consultar contexto de qualquer tenant.
 * Autorização é feita via RLS + verificação de role dentro da função.
 */
export const getTenantBillingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<BillingContext | { error: string }> => {
    const { supabase, userId } = context;
    // Verifica role super_admin
    const { data: isAdmin } = await supabase.rpc("has_role" as any, {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isAdmin) return { error: "Forbidden" };

    const { data: ctx, error } = await supabase.rpc("resolve_tenant_billing_context" as any, {
      _tenant_id: data.tenantId,
    });
    if (error) return { error: error.message };
    return ctx as BillingContext;
  });
