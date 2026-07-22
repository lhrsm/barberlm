import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { getStripeEnvironment } from "@/lib/stripe";
import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

interface TrialAddon {
  id: string;
  trial_ends_at: string;
  saas_addons: { name: string } | null;
}

/**
 * Shows a top banner when the tenant has add-ons in trial ending in ≤ 3 days.
 * Persists dismissal per-day in localStorage.
 */
export function TrialEndingBanner() {
  const { tenantId } = useTenant();
  const [dismissed, setDismissed] = useState(false);
  const env = (() => {
    try { return getStripeEnvironment(); } catch { return "sandbox" as const; }
  })();

  const today = new Date().toISOString().slice(0, 10);
  const dismissKey = `trial-banner-dismissed-${today}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  const { data: trials = [] } = useQuery({
    queryKey: ["addons-trials-ending", tenantId, env],
    queryFn: async (): Promise<TrialAddon[]> => {
      if (!tenantId) return [];
      const in3Days = new Date(Date.now() + 3 * 86400_000).toISOString();
      const { data } = await supabase
        .from("tenant_addons" as any)
        .select("id, trial_ends_at, saas_addons:addon_id(name)")
        .eq("tenant_id", tenantId)
        .eq("environment", env)
        .eq("status", "trialing")
        .eq("cancel_at_period_end", false)
        .not("trial_ends_at", "is", null)
        .lte("trial_ends_at", in3Days)
        .gte("trial_ends_at", new Date().toISOString());
      return (data as unknown as TrialAddon[]) || [];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  if (dismissed || trials.length === 0) return null;

  const soonest = trials[0];
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(soonest.trial_ends_at).getTime() - Date.now()) / 86400_000),
  );
  const names = trials.map((t) => t.saas_addons?.name).filter(Boolean).join(", ");
  const dayLabel = daysLeft <= 1 ? "menos de 1 dia" : `${daysLeft} dias`;

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-3 sm:p-4 flex items-center gap-3 shadow-lg">
      <div className="w-9 h-9 rounded-xl bg-amber-500/25 border border-amber-500/40 grid place-items-center shrink-0">
        <Sparkles className="w-4 h-4 text-amber-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white">
          {trials.length > 1
            ? `${trials.length} trials terminam em breve`
            : `Trial termina em ${dayLabel}`}
        </div>
        <div className="text-xs text-amber-100/80 truncate">
          {names}
          {trials.length === 1 && ` — cobrança começa em ${dayLabel}`}
        </div>
      </div>
      <Link
        to="/subscription"
        className="hidden sm:inline-flex text-xs font-semibold text-amber-200 hover:text-amber-100 underline underline-offset-2 shrink-0"
      >
        Gerenciar
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
