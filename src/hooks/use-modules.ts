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
  | "pix_key";

// Módulos sempre habilitados (essenciais)
const ALWAYS_ON: string[] = [
  "dashboard",
  "calendar",
  "customers",
  "barbers",
  "services",
  "finances",
  "settings",
];

// Padrões para novas barbearias (somente essenciais ativos)
export const DEFAULT_MODULES: Record<ModuleKey, boolean> = {
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
};

export function useModules() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
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

  const modules = { ...DEFAULT_MODULES, ...(data || {}) } as Record<ModuleKey, boolean>;

  const isEnabled = (key: ModuleKey | string): boolean => {
    if (ALWAYS_ON.includes(key)) return true;
    return !!modules[key as ModuleKey];
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: ModuleKey; enabled: boolean }) => {
      if (!tenantId) throw new Error("Sem barbearia");
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
    isEnabled,
    isLoading,
    toggleModule: (key: ModuleKey, enabled: boolean) => toggleMutation.mutate({ key, enabled }),
    isToggling: toggleMutation.isPending,
  };
}
