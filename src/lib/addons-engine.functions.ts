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
      const { supabase, userId } = context;
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
