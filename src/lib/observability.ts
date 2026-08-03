import { createIsomorphicFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

interface LogPayload {
  message: string;
  level: LogLevel;
  tenant_id?: string;
  user_id?: string;
  correlation_id?: string;
  operation?: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
  error?: any;
  timestamp: string;
}

/**
 * BX-Logger: Sistema de Logs Estruturados do Barbex
 */
export const bxLog = createIsomorphicFn()
  .server((level: LogLevel, message: string, data: Partial<LogPayload> = {}) => {
    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlation_id: (globalThis as any).currentCorrelationId || "unknown",
      ...data,
    };

    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(payload));
    } else {
      const color = level === 'error' || level === 'critical' ? '\x1b[31m' : '\x1b[36m';
      console.log(`${color}[${payload.timestamp}] [${level.toUpperCase()}] ${message}\x1b[0m`, data.metadata || '');
    }
  })
  .client((level: LogLevel, message: string, data: Partial<LogPayload> = {}) => {
    if (import.meta.env.DEV) {
      console[level === 'critical' ? 'error' : level](`[BX-LOG] ${message}`, data);
    }
  });

/**
 * Middleware para gerar e propagar Correlation ID
 */
export const correlationMiddleware = createMiddleware()
  .server(async ({ next }) => {
    const correlationId = `BX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    (globalThis as any).currentCorrelationId = correlationId;
    
    const result = await next();
    
    // Injeção opcional no header de resposta se for uma Request
    return result;
  });

/**
 * BX-Trace: Utilitário para medir duração de operações
 */
export const bxTrace = async <T>(
  operation: string,
  fn: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    bxLog("info", `Trace: ${operation}`, { operation, duration_ms: duration, metadata });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    bxLog("error", `Trace Failed: ${operation}`, { operation, duration_ms: duration, error, metadata });
    throw error;
  }
};

