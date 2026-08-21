import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { ROLE_PERMISSIONS_MATRIX, checkRolePermission } from "@/lib/permissions.matrix";

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
      if (!user) return [];

      // Se for super_admin, admin ou tenant_admin, tem acesso total
      if (role === 'super_admin' || role === 'admin' || role === 'tenant_admin') {
        return ['*'];
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role', role as any);

      if (error || !data || data.length === 0) {
        // Fallback canônico da matriz central
        const staticPerms = role ? ROLE_PERMISSIONS_MATRIX[role] : [];
        return staticPerms || [];
      }

      return data.map(p => p.permission_key);
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const hasPermission = (key: PermissionKey): boolean => {
    if (role === 'super_admin' || role === 'admin' || role === 'tenant_admin') return true;
    
    // Se temos permissões carregadas, verifica diretamente
    if (permissions && permissions.length > 0) {
      if (permissions.includes('*')) return true;
      return permissions.includes(key);
    }

    // Enquanto carrega ou se não há dados remotos, usa a matriz estática canônica
    return checkRolePermission(role, key);
  };

  const hasAnyPermission = (keys: PermissionKey[]): boolean => {
    return keys.some(key => hasPermission(key));
  };

  const hasAllPermissions = (keys: PermissionKey[]): boolean => {
    return keys.every(key => hasPermission(key));
  };

  return {
    permissions: permissions || (role ? ROLE_PERMISSIONS_MATRIX[role] : []),
    loading: authLoading || permissionsLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    role
  };
}
