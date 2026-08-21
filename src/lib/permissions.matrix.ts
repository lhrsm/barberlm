import { type PermissionKey } from "@/hooks/use-permissions";
import { type UserRole } from "@/hooks/use-auth";

/**
 * Matriz Canônica de Permissões por Perfil (RBAC) do Barbex
 */
export const ROLE_PERMISSIONS_MATRIX: Record<UserRole, PermissionKey[] | ["*"]> = {
  super_admin: ["*"],
  admin: ["*"],
  tenant_admin: ["*"],

  manager: [
    "dashboard:view",
    "command_center:view",
    "appointments:view",
    "appointments:create",
    "appointments:manage",
    "clients:view",
    "clients:manage",
    "professionals:view",
    "marketing:view",
    "marketing:manage",
  ],

  reception: [
    "appointments:view",
    "appointments:create",
    "appointments:manage",
    "clients:view",
    "clients:manage",
    "professionals:view",
  ],

  receptionist: [
    "appointments:view",
    "appointments:create",
    "appointments:manage",
    "clients:view",
    "clients:manage",
    "professionals:view",
  ],

  financial: [
    "dashboard:view",
    "finances:view",
    "finances:manage",
  ],

  finance: [
    "dashboard:view",
    "finances:view",
    "finances:manage",
  ],

  cashier: [
    "dashboard:view",
    "finances:view",
    "appointments:view",
  ],

  barber: [
    "appointments:view",
    "professionals:view",
  ],

  professional: [
    "appointments:view",
    "professionals:view",
  ],

  client: [],
};

/**
 * Verifica se um papel tem permissão para uma chave específica
 */
export function checkRolePermission(role: UserRole | null | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  if (role === "super_admin" || role === "admin" || role === "tenant_admin") return true;

  const perms = ROLE_PERMISSIONS_MATRIX[role] as readonly (PermissionKey | "*")[];
  if (!perms || perms.length === 0) return false;
  if ((perms as readonly string[]).includes("*")) return true;
  return (perms as readonly string[]).includes(permission);
}

/**
 * Determina a rota inicial padrão para cada perfil após autenticação
 */
export function getDefaultRouteForRole(role: UserRole | null | undefined, slug?: string | null): string {
  switch (role) {
    case "super_admin":
      return "/admin/dashboard";
    case "reception":
    case "receptionist":
      return "/reception";
    case "barber":
    case "professional":
      return slug && slug !== "general" ? `/${slug}/profissional` : "/dashboard";
    case "client":
      return slug && slug !== "general" ? `/${slug}/portal` : "/auth";
    case "manager":
    case "financial":
    case "finance":
    case "cashier":
    case "admin":
    case "tenant_admin":
    default:
      return "/dashboard";
  }
}
