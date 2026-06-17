import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MODULES, type ModuleKey } from "./use-modules";

const ALWAYS_ON = new Set([
  "dashboard",
  "calendar",
  "customers",
  "barbers",
  "services",
  "finances",
  "settings",
]);

/**
 * Public hook (anon-safe) — reads barbershop_modules for a given tenant_id.
 * Used in the public-facing pages (/$slug, /$slug/portal, etc.) to hide
 * sections of features that the barbershop has disabled in Settings > Modules.
 */
export function usePublicModules(tenantId?: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-barbershop-modules", tenantId],
    queryFn: async () => {
      if (!tenantId) return {} as Record<string, boolean>;
      const { data, error } = await supabase
        .from("barbershop_modules" as any)
        .select("module_key, enabled")
        .eq("tenant_id", tenantId);
      if (error) {
        console.warn("[usePublicModules] error", error);
        return {} as Record<string, boolean>;
      }
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.module_key] = row.enabled;
      });
      return map;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const modules = { ...DEFAULT_MODULES, ...(data || {}) } as Record<ModuleKey, boolean>;

  const isEnabled = (key: ModuleKey | string): boolean => {
    if (ALWAYS_ON.has(key)) return true;
    return !!modules[key as ModuleKey];
  };

  return { modules, isEnabled, isLoading };
}
