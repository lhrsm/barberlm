import { createIsomorphicFn, createMiddleware } from "@tanstack/react-start";

async function getCrypto() {
  if (typeof window === 'undefined') {
    return await import("node:crypto");
  }
  return null;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical" | "audit";

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
  integrity_hash?: string;
}

/**
 * BX-Logger: Sistema de Logs Estruturados do Barbex
 * Integridade Imutável (Fase 7): Gera um hash para auditoria de logs críticos.
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

    // Auditoria Imutável (Fase 7): Para logs de nível 'audit' ou 'critical'
    if (level === 'audit' || level === 'critical') {
      const logString = `${payload.timestamp}|${payload.level}|${payload.message}|${payload.correlation_id}`;
      getCrypto().then(crypto => {
        if (crypto) {
          payload.integrity_hash = crypto.createHash('sha256').update(logString).digest('hex');
        }
      });
    }

    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(payload));
    } else {
      const color = level === 'error' || level === 'critical' ? '\x1b[31m' : 
                   level === 'audit' ? '\x1b[35m' : '\x1b[36m';
      console.log(`${color}[${payload.timestamp}] [${level.toUpperCase()}] ${message}\x1b[0m`, data.metadata || '');
    }
  })
  .client((level: LogLevel, message: string, data: Partial<LogPayload> = {}) => {
    if (import.meta.env.DEV) {
      console[level === 'critical' || level === 'audit' ? 'error' : level](`[BX-LOG] ${message}`, data);
    }
  });

/**
 * Middleware para gerar e propagar Correlation ID em Server Functions
 */
export const correlationMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    const correlationId = `BX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    (globalThis as any).currentCorrelationId = correlationId;
    return next();
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
