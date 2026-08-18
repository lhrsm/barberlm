import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type PermissionKey = 
  | 'dashboard:view'
  | 'command_center:view'
  | 'appointments:view'
  | 'appointments:create'
  | 'appointments:manage'
  | 'clients:view'
  | 'clients:manage'
  | 'finances:view'
  | 'finances:manage'
  | 'professionals:view'
  | 'professionals:manage'
  | 'users:manage'
  | 'marketing:view'
  | 'marketing:manage'
  | 'integrations:manage'
  | 'settings:manage'
  | 'security:manage';

export function usePermissions() {
  const { user, role, loading: authLoading } = useAuth();

  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-permissions', user?.id, role],
    queryFn: async () => {
      console.log("[PERMISSIONS_TRACE] Fetching for role:", role, "userId:", user?.id);
      if (!user) return [];

      // Se for super_admin, retorna todas (simulado no front, validado no back)
      if (role === 'super_admin') {
        return ['*']; // Wildcard para todas
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role', role as any);

      if (error) {
        console.error("Error fetching permissions:", error);
        return [];
      }

      return data.map(p => p.permission_key);
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const hasPermission = (key: PermissionKey): boolean => {
    if (role === 'super_admin') return true;
    if (!permissions) return false;
    if (permissions.includes('*')) return true;
    return permissions.includes(key);
  };

  const hasAnyPermission = (keys: PermissionKey[]): boolean => {
    return keys.some(key => hasPermission(key));
  };

  const hasAllPermissions = (keys: PermissionKey[]): boolean => {
    return keys.every(key => hasPermission(key));
  };

  return {
    permissions,
    loading: authLoading || permissionsLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    role
  };
}
