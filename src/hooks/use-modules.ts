import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./use-tenant";
import { toast } from "sonner";

export type ModuleKey =
  | "products"
  | "subscriptions"
  | "loyalty"
  | "cashback"
  | "campaigns"
  | "automations"
  | "commissions"
  | "tutorials"
  | "integrations"
  | "support"
  | "coupons"
  | "whatsapp"
  | "pix_key"
  | "subscription_rewards"
  | "multi_units"
  | "white_label"
  | "api_access"
  | "corporate_reports";

// Módulos sempre habilitados (essenciais do core)
const ALWAYS_ON: string[] = [
  "dashboard",
  "calendar",
  "customers",
  "barbers",
  "services",
  "finances",
  "settings",
];

export const DEFAULT_MODULES: Record<string, boolean> = {
  products: false,
  subscriptions: false,
  loyalty: false,
  cashback: false,
  campaigns: false,
  automations: false,
  commissions: false,
  tutorials: false,
  integrations: false,
  support: true,
  coupons: false,
  whatsapp: false,
  pix_key: false,
  subscription_rewards: false,
};

export interface PlanInfo {
  id: string;
  slug: string;
  name: string;
  tier: number;
  allowed_modules: string[];
  price_monthly: number;
  max_addons: number;
}

export interface ActiveAddon {
  id: string;
  addon_id: string;
  addon_key: string;
  name: string;
  module_key: string;
  status: string;
  quantity: number;
  unit_price: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export type AccessSource = "plan" | "addon" | "none";

export function useModules() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  const { data: modulesData, isLoading: loadingModules } = useQuery({
    queryKey: ["barbershop-modules", tenantId],
    queryFn: async () => {
      if (!tenantId) return {} as Record<string, boolean>;
      const { data, error } = await supabase
        .from("barbershop_modules" as any)
        .select("module_key, enabled")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.module_key] = row.enabled;
      });
      return map;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const { data: activeAddons = [], isLoading: loadingAddons } = useQuery({
    queryKey: ["tenant-addons", tenantId],
    queryFn: async (): Promise<ActiveAddon[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_addons" as any)
        .select("id, addon_id, status, quantity, unit_price, current_period_end, cancel_at_period_end, saas_addons:addon_id(addon_key, name, module_key)")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "trialing", "past_due"]);
      if (error) return [];
      return (data || []).map((r: any) => ({
        id: r.id,
        addon_id: r.addon_id,
        addon_key: r.saas_addons?.addon_key ?? "",
        name: r.saas_addons?.name ?? "",
        module_key: r.saas_addons?.module_key ?? "",
        status: r.status,
        quantity: r.quantity ?? 1,
        unit_price: Number(r.unit_price ?? 0),
        current_period_end: r.current_period_end ?? null,
        cancel_at_period_end: !!r.cancel_at_period_end,
      }));
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const { data: plan, isLoading: loadingPlan } = useQuery({
    queryKey: ["barbershop-plan", tenantId],
    queryFn: async (): Promise<PlanInfo | null> => {
      if (!tenantId) return null;

      let slug: string | null = null;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end")
        .eq("user_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const subStatus = (sub?.status || "").toLowerCase();
      const subActive = ["active", "trialing", "past_due", "paid"].includes(subStatus);
      if (subActive && sub?.price_id) {
        const fromPrice = String(sub.price_id).split("_")[0].toLowerCase();
        if (["starter", "pro", "elite"].includes(fromPrice)) slug = fromPrice;
      }

      if (!slug) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("plan, effective_plan, trial_end")
          .eq("id", tenantId)
          .maybeSingle();

        const trialActive = prof?.trial_end && new Date(prof.trial_end as any) > new Date();
        if (trialActive) {
          slug = "pro";
        } else {
          const raw = ((prof?.effective_plan as string) || (prof?.plan as string) || "").toLowerCase();
          if (raw && raw !== "free") {
            if (raw === "professional") slug = "pro";
            else if (raw === "enterprise") slug = "elite";
            else slug = raw;
          }
        }
      }

      let planRow: any = null;
      if (slug) {
        const { data } = await supabase
          .from("plans")
          .select("id, slug, name, tier, allowed_modules, price_monthly, max_addons")
          .eq("slug", slug)
          .maybeSingle();
        planRow = data;
      }

      if (!planRow) {
        const { data: bsh } = await supabase
          .from("barbershops" as any)
          .select("plan_id, plans:plan_id(id, slug, name, tier, allowed_modules, price_monthly, max_addons)")
          .eq("id", tenantId)
          .maybeSingle();
        planRow = (bsh as any)?.plans;
      }

      if (!planRow) return null;
      return {
        id: planRow.id,
        slug: planRow.slug,
        name: planRow.name,
        tier: planRow.tier ?? 0,
        allowed_modules: Array.isArray(planRow.allowed_modules) ? planRow.allowed_modules : [],
        price_monthly: Number(planRow.price_monthly ?? 0),
        max_addons: Number((planRow as any).max_addons ?? 3),
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });


  const modules = { ...DEFAULT_MODULES, ...(modulesData || {}) } as Record<string, boolean>;
  const planAllowed = new Set<string>([
    ...ALWAYS_ON,
    ...(plan?.allowed_modules || []),
  ]);
  const addonAllowed = new Set<string>(activeAddons.map((a) => a.module_key).filter(Boolean));

  const accessSource = (key: string): AccessSource => {
    if (ALWAYS_ON.includes(key)) return "plan";
    if (planAllowed.has(key)) return "plan";
    if (addonAllowed.has(key)) return "addon";
    return "none";
  };

  const isAllowed = (key: string): boolean => {
    if (ALWAYS_ON.includes(key)) return true;
    // permissivo enquanto carrega — evita flicker
    if (!plan && loadingPlan) return true;
    return planAllowed.has(key) || addonAllowed.has(key);
  };

  const isEnabled = (key: string): boolean => {
    if (ALWAYS_ON.includes(key)) return true;
    if (!isAllowed(key)) return false;
    return !!modules[key];
  };

  // Automações extras (pacote de 5 por unidade) + ilimitadas
  const hasUnlimitedAutomations = addonAllowed.has("automations_unlimited");
  const extraAutomationsFromAddons = activeAddons.reduce((sum, a) => {
    if (a.module_key === "automations_extra") {
      // pacote: cada quantidade = +5 automações; add-on avulso: +1 por unidade
      const perUnit = a.addon_key === "automations_pack_5" ? 5 : 1;
      return sum + a.quantity * perUnit;
    }
    return sum;
  }, 0);

  const addonsUsedCount = activeAddons.length;
  const addonsLimit = plan?.max_addons ?? 3;
  const canAddMoreAddons = hasUnlimitedAutomations ? true : addonsUsedCount < addonsLimit;

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: ModuleKey | string; enabled: boolean }) => {
      if (!tenantId) throw new Error("Sem barbearia");
      if (!isAllowed(key)) throw new Error("Módulo não incluso no seu plano");
      const { error } = await supabase
        .from("barbershop_modules" as any)
        .upsert(
          { tenant_id: tenantId, module_key: key, enabled },
          { onConflict: "tenant_id,module_key" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["barbershop-modules", tenantId] });
      toast.success(vars.enabled ? "Módulo ativado" : "Módulo desativado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar módulo"),
  });

  return {
    modules,
    plan,
    allowedModules: new Set([...planAllowed, ...addonAllowed]),
    activeAddons,
    accessSource,
    isAllowed,
    isEnabled,
    isLoading: loadingModules || loadingPlan || loadingAddons,
    hasUnlimitedAutomations,
    extraAutomationsFromAddons,
    addonsUsedCount,
    addonsLimit,
    canAddMoreAddons,
    toggleModule: (key: ModuleKey | string, enabled: boolean) =>
      toggleMutation.mutate({ key, enabled }),
    isToggling: toggleMutation.isPending,
  };
}

