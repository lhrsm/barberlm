import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Enterprise Audit & RBAC Engine
 */

export const getAuditLogs = createServerFn({ method: "GET" })
  .inputValidator(z.object({ 
    limit: z.number().optional().default(20),
    offset: z.number().optional().default(0)
  }))
  .handler(async ({ data }) => {
    // Simulação de logs de auditoria imutáveis
    return [
      { 
        id: "log_1", 
        timestamp: new Date().toISOString(), 
        actor: "Admin (João)", 
        action: "UPDATE_RLS_POLICY", 
        target: "appointments", 
        status: "success",
        severity: "low"
      },
      { 
        id: "log_2", 
        timestamp: new Date(Date.now() - 3600000).toISOString(), 
        actor: "System", 
        action: "MFA_ENROLL_REQUIRED", 
        target: "super_admin", 
        status: "info",
        severity: "medium"
      },
      { 
        id: "log_3", 
        timestamp: new Date(Date.now() - 86400000).toISOString(), 
        actor: "Unknown", 
        action: "UNAUTHORIZED_ACCESS_ATTEMPT", 
        target: "api/admin", 
        status: "blocked",
        severity: "high"
      }
    ];
  });

export const getRBACMatrix = createServerFn({ method: "GET" })
  .handler(async () => {
    return [
      { role: "super_admin", permissions: ["ALL"], description: "Acesso total irrestrito" },
      { role: "admin", permissions: ["MANAGE_TENANT", "VIEW_FINANCES", "MANAGE_TEAM"], description: "Gestão completa do estabelecimento" },
      { role: "manager", permissions: ["MANAGE_APPOINTMENTS", "VIEW_TEAM"], description: "Gestão operacional e equipe" },
      { role: "finance", permissions: ["VIEW_FINANCES", "EXPORT_REPORTS"], description: "Acesso financeiro restrito" }
    ];
  });
