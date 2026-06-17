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
}

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

  const { data: plan, isLoading: loadingPlan } = useQuery({
    queryKey: ["barbershop-plan", tenantId],
    queryFn: async (): Promise<PlanInfo | null> => {
      if (!tenantId) return null;

      // 1) Tenta resolver pelo profile (plan/effective_plan), com mapping legacy.
      const { data: prof } = await supabase
        .from("profiles")
        .select("plan, effective_plan, trial_end")
        .eq("id", tenantId)
        .maybeSingle();

      let slug: string | null = null;
      const trialActive = prof?.trial_end && new Date(prof.trial_end as any) > new Date();
      if (trialActive) {
        slug = "professional"; // trial dá acesso ao nível pro/professional
      } else {
        const raw = ((prof?.effective_plan as string) || (prof?.plan as string) || "").toLowerCase();
        if (raw && raw !== "free") slug = raw === "pro" ? "professional" : raw;
      }

      let planRow: any = null;
      if (slug) {
        const { data } = await supabase
          .from("plans")
          .select("id, slug, name, tier, allowed_modules, price_monthly")
          .eq("slug", slug)
          .maybeSingle();
        planRow = data;
      }

      // 2) Fallback: barbershops.plan_id (legado)
      if (!planRow) {
        const { data: bsh } = await supabase
          .from("barbershops" as any)
          .select("plan_id, plans:plan_id(id, slug, name, tier, allowed_modules, price_monthly)")
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
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });


  const modules = { ...DEFAULT_MODULES, ...(modulesData || {}) } as Record<string, boolean>;
  const allowedModules = new Set<string>([
    ...ALWAYS_ON,
    ...(plan?.allowed_modules || []),
  ]);

  const isAllowed = (key: string): boolean => {
    if (ALWAYS_ON.includes(key)) return true;
    // If plan info hasn't loaded yet, be permissive to avoid flicker; UI gates re-render once loaded
    if (!plan) return true;
    return allowedModules.has(key);
  };

  const isEnabled = (key: string): boolean => {
    if (ALWAYS_ON.includes(key)) return true;
    if (!isAllowed(key)) return false;
    return !!modules[key];
  };

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
    allowedModules,
    isAllowed,
    isEnabled,
    isLoading: loadingModules || loadingPlan,
    toggleModule: (key: ModuleKey | string, enabled: boolean) =>
      toggleMutation.mutate({ key, enabled }),
    isToggling: toggleMutation.isPending,
  };
}
