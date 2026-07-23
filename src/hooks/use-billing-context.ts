import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { BillingContext } from "@/lib/billing-context.functions";

// Cache leve por sessão para evitar múltiplas chamadas quando o AppLayout
// e a página /subscription montam ao mesmo tempo.
const cache = new Map<string, BillingContext>();

export function useBillingContext() {
  const { user } = useAuth();
  const [ctx, setCtx] = useState<BillingContext | null>(user ? cache.get(user.id) ?? null : null);
  const [loading, setLoading] = useState(!ctx);

  useEffect(() => {
    if (!user) {
      setCtx(null);
      setLoading(false);
      return;
    }
    const cached = cache.get(user.id);
    if (cached) {
      setCtx(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("resolve_tenant_billing_context" as any, {
        _tenant_id: user.id,
      });
      if (cancelled) return;
      if (error || !data || (data as any).error) {
        setCtx(null);
      } else {
        cache.set(user.id, data as BillingContext);
        setCtx(data as BillingContext);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { ctx, loading, isInternalTesting: !!ctx?.is_internal_test_tenant };
}
