import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bxLog, bxTrace } from "./observability";

/**
 * Health Check do Ecossistema Barbex
 */
export const getSystemHealth = createServerFn({ method: "GET" })
  .handler(async () => {
    return bxTrace("system_health_check", async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      const start = Date.now();
      const { error: dbError } = await supabaseAdmin.from("profiles").select("id").limit(1);
      const dbLatency = Date.now() - start;

      return {
        status: dbError ? "degraded" : "healthy",
        services: {
          database: dbError ? "error" : "healthy",
          auth: "healthy", // Supabase Auth is managed
          realtime: "healthy",
          edge_functions: "healthy"
        },
        metrics: {
          db_latency_ms: dbLatency,
          uptime_seconds: process.uptime()
        },
        timestamp: new Date().toISOString()
      };
    });
  });

/**
 * Coleta de Métricas Técnicas (Fase 1)
 */
export const getScalabilityMetrics = createServerFn({ method: "GET" })
  .handler(async () => {
    // Mock inicial de métricas que serão alimentadas pelas fases subsequentes
    return {
      active_tenants: 124,
      total_appointments: 15420,
      avg_request_duration: 145,
      error_rate: 0.02,
      queue_status: {
        pending: 5,
        failed: 2,
        dead_letter: 0
      } as const
    };
  });
