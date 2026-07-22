import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { getStripeEnvironment } from "@/lib/stripe";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

interface FailedAddon {
  id: string;
  payment_failed_count: number;
  last_payment_error: string | null;
  last_payment_failed_at: string | null;
  saas_addons: { name: string } | null;
}

/**
 * Alerta no topo quando existe add-on com falha de pagamento pendente.
 * Dismiss diário via localStorage.
 */
export function AddonPaymentFailedBanner() {
  const { tenantId } = useTenant();
  const [dismissed, setDismissed] = useState(false);
  const env = (() => {
    try { return getStripeEnvironment(); } catch { return "sandbox" as const; }
  })();

  const today = new Date().toISOString().slice(0, 10);
  const dismissKey = `addon-payfail-banner-${today}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  const { data: failed = [] } = useQuery({
    queryKey: ["addons-payment-failed", tenantId, env],
    queryFn: async (): Promise<FailedAddon[]> => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("tenant_addons" as any)
        .select("id, payment_failed_count, last_payment_error, last_payment_failed_at, saas_addons:addon_id(name)")
        .eq("tenant_id", tenantId)
        .eq("environment", env)
        .gt("payment_failed_count", 0)
        .neq("status", "canceled");
      return (data as unknown as FailedAddon[]) || [];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  if (dismissed || failed.length === 0) return null;

  const first = failed[0];
  const names = failed.map((f) => f.saas_addons?.name).filter(Boolean).join(", ");
  const attempts = Math.max(...failed.map((f) => f.payment_failed_count));
  const critical = attempts >= 3;

  return (
    <div className={`mb-4 rounded-2xl border p-3 sm:p-4 flex items-center gap-3 shadow-lg ${
      critical
        ? "border-red-500/50 bg-gradient-to-r from-red-500/20 via-red-500/10 to-transparent"
        : "border-orange-500/40 bg-gradient-to-r from-orange-500/15 via-orange-500/10 to-transparent"
    }`}>
      <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 border ${
        critical ? "bg-red-500/25 border-red-500/40" : "bg-orange-500/25 border-orange-500/40"
      }`}>
        <AlertTriangle className={`w-4 h-4 ${critical ? "text-red-300" : "text-orange-300"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white">
          {failed.length > 1
            ? `${failed.length} módulos com pagamento pendente`
            : "Falha no pagamento de módulo"}
          {critical && " — última tentativa"}
        </div>
        <div className="text-xs text-white/70 truncate">
          {names} · {attempts} {attempts === 1 ? "tentativa" : "tentativas"}
          {first.last_payment_error && ` · ${first.last_payment_error}`}
        </div>
      </div>
      <Link
        to="/subscription"
        className={`hidden sm:inline-flex text-xs font-semibold underline underline-offset-2 shrink-0 ${
          critical ? "text-red-200 hover:text-red-100" : "text-orange-200 hover:text-orange-100"
        }`}
      >
        Atualizar pagamento
      </Link>
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => {
          localStorage.setItem(dismissKey, "1");
          setDismissed(true);
        }}
        className="w-7 h-7 rounded-lg text-white/60 hover:text-white hover:bg-white/10 grid place-items-center shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
