import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import {
  canReceptionPerform,
  type ReceptionAction,
} from "@/lib/reception-permissions";

/**
 * Contexto do Portal da Recepção.
 * - Dono/admin da barbearia: acesso total (usa o próprio tenant).
 * - Usuário de recepção: tenant e permissões vêm de `reception_permissions`.
 */
export function useReception() {
  const { user, profile, loading: authLoading } = useAuth();

  const isOwner =
    profile?.role === "tenant_admin" ||
    profile?.role === "admin" ||
    profile?.role === "super_admin";

  const { data: receptionRow, isLoading: rowLoading } = useQuery({
    queryKey: ["reception-permissions", user?.id],
    enabled: !!user?.id && !isOwner,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reception_permissions")
        .select("id, tenant_id, permissions, is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tenantId = isOwner
    ? profile?.tenant_id || profile?.id || null
    : receptionRow?.tenant_id || null;

  const permissions = (receptionRow?.permissions as Record<string, any> | null) ?? null;
  const isReception = !!receptionRow;
  const hasAccess = isOwner || isReception;
  const loading = authLoading || (!isOwner && rowLoading);

  const can = (action: ReceptionAction) =>
    canReceptionPerform(action, { isOwner, permissions });

  return { loading, hasAccess, isOwner, isReception, tenantId, permissions, can, user, profile };
}
