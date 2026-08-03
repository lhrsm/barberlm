import { bxLog, bxTrace } from "./observability";

/**
 * bxLock: Utilitário para garantir idempotência e evitar race conditions
 * Utiliza um lock otimista baseado em chave única por operação.
 */
export const bxLock = async <T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  return bxTrace(`lock:${lockKey}`, async () => {
    const anySupabase = supabaseAdmin as any;
    
    // 1. Tentar adquirir o lock
    try {
      const { error: lockError } = await anySupabase.from("operation_locks").insert({
        key: lockKey,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      });

      if (lockError) {
        bxLog("warn", `Race condition prevented for key: ${lockKey}`, { metadata: { lockKey } });
        throw new Error("Uma operação idêntica já está em processamento.");
      }
    } catch (e) {
      bxLog("debug", "Operation lock table not available or error acquiring lock", { error: e });
    }

    try {
      const result = await fn();
      return result;
    } finally {
      // 2. Liberar o lock
      try {
        await anySupabase.from("operation_locks").delete().eq("key", lockKey);
      } catch (e) {}
    }
  });
};

/**
 * Circuit Breaker: Protege o sistema contra falhas em cascata de serviços externos.
 */
interface CircuitState {
  failures: number;
  lastFailureTime: number;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuitStates = new Map<string, CircuitState>();

export const withCircuitBreaker = async <T>(
  serviceName: string,
  fn: () => Promise<T>,
  options = { threshold: 5, resetTimeoutMs: 30000 }
): Promise<T> => {
  const state = circuitStates.get(serviceName) || { failures: 0, lastFailureTime: 0, status: 'CLOSED' };

  if (state.status === 'OPEN') {
    if (Date.now() - state.lastFailureTime > options.resetTimeoutMs) {
      state.status = 'HALF_OPEN';
      bxLog("info", `Circuit breaker for ${serviceName} entering HALF_OPEN state`);
    } else {
      bxLog("warn", `Circuit breaker for ${serviceName} is OPEN. Blocking request.`, { metadata: { serviceName } });
      throw new Error(`Serviço ${serviceName} temporariamente indisponível (Circuit Breaker)`);
    }
  }

  try {
    const result = await fn();
    
    // Sucesso no HALF_OPEN ou CLOSED
    if (state.status !== 'CLOSED') {
      bxLog("info", `Circuit breaker for ${serviceName} recovered to CLOSED`);
      state.status = 'CLOSED';
      state.failures = 0;
    }
    
    circuitStates.set(serviceName, state);
    return result;
  } catch (error: any) {
    state.failures++;
    state.lastFailureTime = Date.now();
    
    if (state.failures >= options.threshold) {
      if ((state.status as string) !== 'OPEN') {
        bxLog("error", `Circuit breaker for ${serviceName} tripped to OPEN`, { error });
        state.status = 'OPEN';
      }
    }
    
    circuitStates.set(serviceName, state);
    throw error;
  }
};

/**
 * Geração de Chave de Idempotência
 */
export const generateIdempotencyKey = (prefix: string, parts: (string | number | undefined)[]) => {
  return `${prefix}:${parts.filter(Boolean).join(':')}`;
};


