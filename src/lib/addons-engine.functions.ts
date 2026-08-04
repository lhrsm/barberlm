import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// Types
// ============================================================================

export type BillingCycle = "monthly" | "annual";

export type ModuleAccessSource = "plan" | "addon" | "voucher";

export type ModuleAccess = {
  module_key: string;
  has_access: boolean;
  sources: ModuleAccessSource[];
};

export type CurrentPlan = {
  id: string | null;
  slug: string | null;
  name: string | null;
  tier: number;
  price_monthly: number;
  price_yearly: number;
  allowed_modules: string[];
};

export type ActiveAddon = {
  tenant_addon_id: string;
  addon_id: string;
  addon_key: string;
  module_key: string;
  name: string;
  quantity: number;
  billing_cycle: BillingCycle;
  unit_price: number;
  monthly_equivalent: number;
  access_source: "addon" | "plan" | "voucher";
  status: string;
};

export type AddonAccessSnapshot = {
  tenant_id: string;
  current_plan: CurrentPlan;
  active_addons: ActiveAddon[];
  modules: ModuleAccess[];
  totals: {
    plan_monthly: number;
    addons_monthly: number;
    grand_monthly: number;
  };
};

export type CartItem = {
  addon_id: string;
  quantity: number;
  billing_cycle: BillingCycle;
};

export type ProjectedTotals = {
  cycle: BillingCycle;
  plan_amount: number;
  addons_amount: number;
  total: number;
  breakdown: Array<{
    addon_id: string;
    addon_key: string;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    billing_cycle: BillingCycle;
  }>;
};

export type UpgradeSuggestion = {
  recommended: boolean;
  reason: "cheaper" | "includes_modules" | "no_better_option";
  current_plan: CurrentPlan;
  target_plan: {
    id: string;
    slug: string | null;
    name: string;
    tier: number;
    price_monthly: number;
    price_yearly: number;
    allowed_modules: string[];
  } | null;
  cart_total_monthly: number;
  target_total_monthly: number;
  monthly_savings: number;
  modules_included_by_target: string[];
  modules_still_needed_as_addons: string[];
};

// ============================================================================
// Helpers
// ============================================================================

function toMonthly(unitPrice: number, cycle: BillingCycle): number {
  return cycle === "annual" ? Number(unitPrice) / 12 : Number(unitPrice);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string") as string[];
  return [];
}

async function loadCurrentPlan(sb: any, tenantId: string): Promise<CurrentPlan> {
  // 1. Try to resolve via subscriptions.price_id → plans
  const { data: sub } = await sb
    .from("subscriptions")
    .select("price_id, environment, status")
    .eq("user_id", tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const emptyPlan: CurrentPlan = {
    id: null,
    slug: "free",
    name: "Free",
    tier: 0,
    price_monthly: 0,
    price_yearly: 0,
    allowed_modules: [],
  };

  if (sub?.price_id) {
    const col =
      sub.environment === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
    const { data: plan } = await sb
      .from("plans")
      .select(
        "id, slug, name, tier, price_monthly, price_yearly, allowed_modules",
      )
      .eq(col, sub.price_id)
      .eq("active", true)
      .maybeSingle();
    if (plan) {
      return {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        tier: Number(plan.tier ?? 0),
        price_monthly: Number(plan.price_monthly ?? 0),
        price_yearly: Number(plan.price_yearly ?? 0),
        allowed_modules: asStringArray(plan.allowed_modules),
      };
    }
  }

  return emptyPlan;
}

async function loadActiveAddons(
  sb: any,
  tenantId: string,
): Promise<ActiveAddon[]> {
  const { data, error } = await sb
    .from("tenant_addons")
    .select(
      `id, addon_id, quantity, billing_cycle, unit_price, status, access_source,
       saas_addons ( id, addon_key, module_key, name, monthly_price, annual_price )`,
    )
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing", "past_due"]);

  if (error || !data) return [];

  return (data as any[])
    .filter((row) => row.saas_addons)
    .map<ActiveAddon>((row) => {
      const cycle: BillingCycle = row.billing_cycle === "annual" ? "annual" : "monthly";
      const unit = Number(row.unit_price ?? 0);
      return {
        tenant_addon_id: row.id,
        addon_id: row.addon_id,
        addon_key: row.saas_addons.addon_key,
        module_key: row.saas_addons.module_key,
        name: row.saas_addons.name,
        quantity: Number(row.quantity ?? 1),
        billing_cycle: cycle,
        unit_price: unit,
        monthly_equivalent: toMonthly(unit, cycle) * Number(row.quantity ?? 1),
        access_source: (row.access_source ?? "addon") as ActiveAddon["access_source"],
        status: row.status,
      };
    });
}

function computeModuleAccess(
  plan: CurrentPlan,
  addons: ActiveAddon[],
): ModuleAccess[] {
  const acc = new Map<string, ModuleAccess>();
  for (const key of plan.allowed_modules) {
    acc.set(key, { module_key: key, has_access: true, sources: ["plan"] });
  }
  for (const a of addons) {
    const src: ModuleAccessSource = a.access_source === "voucher" ? "voucher" : "addon";
    const existing = acc.get(a.module_key);
    if (existing) {
      if (!existing.sources.includes(src)) existing.sources.push(src);
      existing.has_access = true;
    } else {
      acc.set(a.module_key, {
        module_key: a.module_key,
        has_access: true,
        sources: [src],
      });
    }
  }
  return Array.from(acc.values());
}

// ============================================================================
// Server functions
// ============================================================================

/**
 * Resolve access snapshot for the authenticated tenant:
 * current plan, active add-ons, effective module access, and monthly totals.
 */
export const resolveModuleAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AddonAccessSnapshot | { error: string }> => {
    try {
      const { supabase, userId } = context as any;

      const [plan, addons] = await Promise.all([
        loadCurrentPlan(supabase, userId),
        loadActiveAddons(supabase, userId),
      ]);
      const modules = computeModuleAccess(plan, addons);
      const addonsMonthly = addons.reduce((sum, a) => sum + a.monthly_equivalent, 0);
      return {
        tenant_id: userId,
        current_plan: plan,
        active_addons: addons,
        modules,
        totals: {
          plan_monthly: plan.price_monthly,
          addons_monthly: Number(addonsMonthly.toFixed(2)),
          grand_monthly: Number((plan.price_monthly + addonsMonthly).toFixed(2)),
        },
      };
    } catch (err: any) {
      console.error("[addons-engine] resolveModuleAccess", err);
      return { error: err?.message ?? "Falha ao resolver acesso a módulos" };
    }
  });

/**
 * Project totals for a hypothetical cart of add-ons on top of the current plan.
 * Does not persist anything.
 */
export const computeProjectedTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cart: CartItem[]; cycle?: BillingCycle }) => input)
  .handler(async ({ data, context }): Promise<ProjectedTotals | { error: string }> => {
    try {
      const { supabase, userId } = context;
      const cycle: BillingCycle = data.cycle ?? "monthly";
      const ids = data.cart.map((c) => c.addon_id);
      const plan = await loadCurrentPlan(supabase, userId);

      if (ids.length === 0) {
        return {
          cycle,
          plan_amount: cycle === "annual" ? plan.price_yearly : plan.price_monthly,
          addons_amount: 0,
          total: cycle === "annual" ? plan.price_yearly : plan.price_monthly,
          breakdown: [],
        };
      }

      const { data: addons, error } = await supabase
        .from("saas_addons")
        .select("id, addon_key, name, monthly_price, annual_price")
        .in("id", ids)
        .eq("is_active", true);
      if (error) return { error: error.message };

      const map = new Map((addons ?? []).map((a: any) => [a.id, a]));
      const breakdown = data.cart
        .map((item) => {
          const a: any = map.get(item.addon_id);
          if (!a) return null;
          const itemCycle = item.billing_cycle ?? cycle;
          const unit = Number(
            itemCycle === "annual" ? a.annual_price ?? 0 : a.monthly_price ?? 0,
          );
          const qty = Math.max(1, Number(item.quantity ?? 1));
          return {
            addon_id: a.id as string,
            addon_key: a.addon_key as string,
            name: a.name as string,
            quantity: qty,
            unit_price: unit,
            subtotal: Number((unit * qty).toFixed(2)),
            billing_cycle: itemCycle as BillingCycle,
          };
        })
        .filter(Boolean) as ProjectedTotals["breakdown"];

      const addonsAmount = breakdown.reduce((s, b) => s + b.subtotal, 0);
      const planAmount = cycle === "annual" ? plan.price_yearly : plan.price_monthly;

      return {
        cycle,
        plan_amount: planAmount,
        addons_amount: Number(addonsAmount.toFixed(2)),
        total: Number((planAmount + addonsAmount).toFixed(2)),
        breakdown,
      };
    } catch (err: any) {
      console.error("[addons-engine] computeProjectedTotals", err);
      return { error: err?.message ?? "Falha ao projetar totais" };
    }
  });

/**
 * Analyze a cart and suggest a higher-tier plan when it becomes cheaper
 * than paying for the current plan plus the requested add-ons.
 *
 * Recommendation rules:
 * - Only consider active plans with a higher tier than the current plan.
 * - A "good" target either includes ALL cart modules OR yields real monthly
 *   savings above `saas_billing_settings.minimum_upgrade_savings`.
 * - Feature toggle: `saas_billing_settings.upgrade_recommendation_enabled`.
 */
export const findBestUpgradeOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cart: CartItem[] }) => input)
  .handler(async ({ data, context }): Promise<UpgradeSuggestion | { error: string }> => {
    try {
      const { supabase, userId } = context;

      // Item 13: barbearias com voucher administrativo (internal_testing)
      // não devem receber recomendação de upgrade — o benefício já cobre tudo.
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_internal_test_tenant")
        .eq("id", userId)
        .maybeSingle();

      const { data: settings } = await supabase
        .from("saas_billing_settings")
        .select("minimum_upgrade_savings, upgrade_recommendation_enabled")
        .maybeSingle();

      const enabled = settings?.upgrade_recommendation_enabled ?? true;
      const minSavings = Number(settings?.minimum_upgrade_savings ?? 5);

      const plan = await loadCurrentPlan(supabase, userId);

      const ids = data.cart.map((c) => c.addon_id);
      const { data: cartAddons } = ids.length
        ? await supabase
            .from("saas_addons")
            .select("id, module_key, monthly_price")
            .in("id", ids)
            .eq("is_active", true)
        : { data: [] as any[] };

      const cartMonthly = data.cart.reduce((sum, item) => {
        const a: any = (cartAddons ?? []).find((x: any) => x.id === item.addon_id);
        if (!a) return sum;
        return sum + Number(a.monthly_price ?? 0) * Math.max(1, item.quantity);
      }, 0);
      const cartModules = (cartAddons ?? []).map((a: any) => a.module_key as string);
      const cartTotal = plan.price_monthly + cartMonthly;

      const empty: UpgradeSuggestion = {
        recommended: false,
        reason: "no_better_option",
        current_plan: plan,
        target_plan: null,
        cart_total_monthly: Number(cartTotal.toFixed(2)),
        target_total_monthly: 0,
        monthly_savings: 0,
        modules_included_by_target: [],
        modules_still_needed_as_addons: cartModules,
      };

      if (!enabled || data.cart.length === 0) return empty;
      // Item 13: voucher administrativo cobre tudo — não sugerir upgrade
      if (profile?.is_internal_test_tenant) return empty;

      const { data: candidates } = await supabase
        .from("plans")
        .select("id, slug, name, tier, price_monthly, price_yearly, allowed_modules")
        .eq("active", true)
        .gt("tier", plan.tier)
        .order("tier", { ascending: true });

      let best: UpgradeSuggestion = empty;
      for (const cand of (candidates ?? []) as any[]) {
        const allowed = asStringArray(cand.allowed_modules);
        const included = cartModules.filter((m) => allowed.includes(m));
        const missing = cartModules.filter((m) => !allowed.includes(m));

        // Cost of remaining add-ons at monthly rate
        const remainingMonthly = data.cart.reduce((sum, item) => {
          const a: any = (cartAddons ?? []).find((x: any) => x.id === item.addon_id);
          if (!a) return sum;
          if (allowed.includes(a.module_key)) return sum; // absorbed by plan
          return sum + Number(a.monthly_price ?? 0) * Math.max(1, item.quantity);
        }, 0);

        const targetTotal = Number(cand.price_monthly ?? 0) + remainingMonthly;
        const savings = cartTotal - targetTotal;

        const includesAll = missing.length === 0;
        const worthIt = savings >= minSavings;

        if ((includesAll || worthIt) && savings > best.monthly_savings) {
          best = {
            recommended: true,
            reason: includesAll ? "includes_modules" : "cheaper",
            current_plan: plan,
            target_plan: {
              id: cand.id,
              slug: cand.slug,
              name: cand.name,
              tier: Number(cand.tier ?? 0),
              price_monthly: Number(cand.price_monthly ?? 0),
              price_yearly: Number(cand.price_yearly ?? 0),
              allowed_modules: allowed,
            },
            cart_total_monthly: Number(cartTotal.toFixed(2)),
            target_total_monthly: Number(targetTotal.toFixed(2)),
            monthly_savings: Number(savings.toFixed(2)),
            modules_included_by_target: included,
            modules_still_needed_as_addons: missing,
          };
        }
      }

      return best;
    } catch (err: any) {
      console.error("[addons-engine] findBestUpgradeOption", err);
      return { error: err?.message ?? "Falha ao calcular recomendação" };
    }
  });

// ============================================================================
// Observability (Fase 5): log de recomendações mostradas / aceitas / dispensadas
// ============================================================================

export type RecommendationAction = "accepted" | "dismissed";

/**
 * Registra uma recomendação exibida ao tenant no carrinho.
 * Grava um snapshot completo para análise posterior no admin.
 */
export const logUpgradeRecommendationShown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      cart: CartItem[];
      suggestion: UpgradeSuggestion;
      billing_cycle: BillingCycle;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    try {
      const { supabase, userId } = context;
      const s = data.suggestion;
      if (!s.recommended || !s.target_plan) {
        return { error: "Nada a registrar (sem recomendação)" };
      }

      // Active add-ons snapshot (ids only, best-effort)
      const { data: activeRows } = await supabase
        .from("tenant_addons")
        .select("addon_id")
        .eq("tenant_id", userId)
        .eq("status", "active");

      const monthlySavings = Number(s.monthly_savings ?? 0);
      const annualSavings = Number((monthlySavings * 12).toFixed(2));

      const { data: inserted, error } = await supabase
        .from("addon_upgrade_recommendations")
        .insert({
          tenant_id: userId,
          current_plan_id: s.current_plan.id,
          recommended_plan_id: s.target_plan.id,
          selected_addon_ids: data.cart.map((c) => c.addon_id),
          active_addon_ids: (activeRows ?? []).map((r: any) => r.addon_id),
          billing_cycle: data.billing_cycle,
          current_option_total: Number(s.cart_total_monthly ?? 0),
          upgrade_option_total: Number(s.target_total_monthly ?? 0),
          monthly_savings: monthlySavings,
          annual_savings: annualSavings,
          recommendation_reason: s.reason,
        })
        .select("id")
        .single();

      if (error) throw error;
      return { id: inserted.id as string };
    } catch (err: any) {
      console.error("[addons-engine] logUpgradeRecommendationShown", err);
      return { error: err?.message ?? "Falha ao registrar recomendação" };
    }
  });

/**
 * Marca uma recomendação previamente registrada como aceita ou dispensada.
 */
export const logUpgradeRecommendationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: RecommendationAction }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    try {
      const { supabase, userId } = context;
      const { error } = await supabase
        .from("addon_upgrade_recommendations")
        .update({
          customer_action: data.action,
          action_taken_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("tenant_id", userId);
      if (error) throw error;
      return { ok: true };
    } catch (err: any) {
      console.error("[addons-engine] logUpgradeRecommendationAction", err);
      return { error: err?.message ?? "Falha ao atualizar ação da recomendação" };
    }
  });

// ============================================================================
// Admin observability
// ============================================================================

export type AdminRecommendationRow = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_email: string | null;
  current_plan_name: string | null;
  recommended_plan_name: string | null;
  billing_cycle: BillingCycle;
  current_option_total: number;
  upgrade_option_total: number;
  monthly_savings: number;
  annual_savings: number;
  recommendation_reason: string | null;
  customer_action: RecommendationAction | null;
  shown_at: string;
  action_taken_at: string | null;
};

export type AdminRecommendationsReport = {
  kpis: {
    total_shown: number;
    total_accepted: number;
    total_dismissed: number;
    total_pending: number;
    conversion_rate: number;
    total_monthly_savings_offered: number;
    total_monthly_savings_accepted: number;
  };
  rows: AdminRecommendationRow[];
};

export const listAdminUpgradeRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } = {}) => input)
  .handler(async ({ data, context }): Promise<AdminRecommendationsReport | { error: string }> => {
    try {
      const { supabase, userId } = context;
      const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (roleErr) throw roleErr;
      if (!isAdmin) return { error: "Acesso negado" };

      const days = Math.max(1, Math.min(365, data.days ?? 90));
      const since = new Date(Date.now() - days * 86400_000).toISOString();

      const { data: recs, error } = await supabase
        .from("addon_upgrade_recommendations")
        .select("*")
        .gte("shown_at", since)
        .order("shown_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const tenantIds = Array.from(new Set((recs ?? []).map((r: any) => r.tenant_id)));
      const planIds = Array.from(
        new Set(
          (recs ?? []).flatMap((r: any) => [r.current_plan_id, r.recommended_plan_id]).filter(Boolean),
        ),
      );

      const [tenantsRes, plansRes] = await Promise.all([
        tenantIds.length
          ? supabase.from("profiles").select("id, business_name, email").in("id", tenantIds)
          : Promise.resolve({ data: [] as any[] }),
        planIds.length
          ? supabase.from("plans").select("id, name").in("id", planIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const tenantMap = new Map(
        ((tenantsRes as any).data ?? []).map((t: any) => [t.id, t]),
      );
      const planMap = new Map(((plansRes as any).data ?? []).map((p: any) => [p.id, p]));

      const rows: AdminRecommendationRow[] = (recs ?? []).map((r: any) => {
        const t = tenantMap.get(r.tenant_id) as any;
        return {
          id: r.id,
          tenant_id: r.tenant_id,
          tenant_name: t?.business_name ?? null,
          tenant_email: t?.email ?? null,
          current_plan_name: (planMap.get(r.current_plan_id) as any)?.name ?? null,
          recommended_plan_name: (planMap.get(r.recommended_plan_id) as any)?.name ?? null,
          billing_cycle: r.billing_cycle,
          current_option_total: Number(r.current_option_total ?? 0),
          upgrade_option_total: Number(r.upgrade_option_total ?? 0),
          monthly_savings: Number(r.monthly_savings ?? 0),
          annual_savings: Number(r.annual_savings ?? 0),
          recommendation_reason: r.recommendation_reason,
          customer_action: r.customer_action,
          shown_at: r.shown_at,
          action_taken_at: r.action_taken_at,
        };
      });

      const total_shown = rows.length;
      const total_accepted = rows.filter((r) => r.customer_action === "accepted").length;
      const total_dismissed = rows.filter((r) => r.customer_action === "dismissed").length;
      const total_pending = total_shown - total_accepted - total_dismissed;
      const decided = total_accepted + total_dismissed;
      const conversion_rate = decided > 0 ? total_accepted / decided : 0;
      const total_monthly_savings_offered = rows.reduce((s, r) => s + r.monthly_savings, 0);
      const total_monthly_savings_accepted = rows
        .filter((r) => r.customer_action === "accepted")
        .reduce((s, r) => s + r.monthly_savings, 0);

      return {
        kpis: {
          total_shown,
          total_accepted,
          total_dismissed,
          total_pending,
          conversion_rate: Number(conversion_rate.toFixed(4)),
          total_monthly_savings_offered: Number(total_monthly_savings_offered.toFixed(2)),
          total_monthly_savings_accepted: Number(total_monthly_savings_accepted.toFixed(2)),
        },
        rows,
      };
    } catch (err: any) {
      console.error("[addons-engine] listAdminUpgradeRecommendations", err);
      return { error: err?.message ?? "Falha ao carregar recomendações" };
    }
  });

