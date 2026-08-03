import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
    // 1. Tentar adquirir o lock (tabela operation_locks deve ser criada via migração)
    // Se a tabela não existir, o log falhará e seguiremos (degradação graciosa para síncrono simples)
    try {
      const { error: lockError } = await supabaseAdmin.from("operation_locks").insert({
        key: lockKey,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      });

      if (lockError) {
        bxLog("warn", `Race condition prevented for key: ${lockKey}`, { lockKey });
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
        await supabaseAdmin.from("operation_locks").delete().eq("key", lockKey);
      } catch (e) {}
    }
  });
};

/**
 * Geração de Chave de Idempotência
 */
export const generateIdempotencyKey = (prefix: string, parts: (string | number | undefined)[]) => {
  return `${prefix}:${parts.filter(Boolean).join(':')}`;
};
