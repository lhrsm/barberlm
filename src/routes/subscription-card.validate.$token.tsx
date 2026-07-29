import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Pause, Crown, Scissors, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/subscription-card/validate/$token")({
  component: ValidatePage,
});

function ValidatePage() {
  const { token } = Route.useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  async function load() {
    setLoading(true);
    const { data: result, error } = await supabase.rpc("validate_subscription_card" as any, {
      p_token: token,
      p_scanned_by: user?.id ?? null,
      p_log: true,
    });
    if (error) {
      setData({ valid: false, error: error.message });
    } else {
      setData(result);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  async function consumeBenefit() {
    if (!data?.subscription_id) return;
    setValidating(true);
    const { data: res, error } = await supabase.rpc("consume_subscription_use" as any, {
      p_subscription_id: data.subscription_id,
      p_appointment_id: null,
    });
    if (error || (res as any)?.success === false) {
      toast.error((res as any)?.error || error?.message || "Erro ao validar");
    } else {
      toast.success("Benefício validado com sucesso");
      await load();
    }
    setValidating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070d] grid place-items-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-gold" />
          <p className="text-sm text-zinc-400">Validando cartão...</p>
        </div>
      </div>
    );
  }

  const result = data?.result as string | undefined;
  const isValid = result === "valid";
  const isPaused = result === "paused";
  const isInvalid = result === "invalid" || result === "revoked" || !data;
  const tone = isValid
    ? { bg: "from-emerald-500/20", border: "border-emerald-500/60", text: "text-emerald-400", Icon: CheckCircle2, label: "ASSINATURA VÁLIDA" }
    : isPaused
    ? { bg: "from-blue-500/20", border: "border-blue-500/60", text: "text-blue-300", Icon: Pause, label: "ASSINATURA PAUSADA" }
    : { bg: "from-red-500/20", border: "border-red-500/60", text: "text-red-400", Icon: XCircle, label: "CARTÃO INVÁLIDO" };

  const customer = data?.customer;
  const plan = data?.plan;
  const reasonLabel: Record<string, string> = {
    token_revoked: "Token revogado",
    subscription_canceled: "Assinatura cancelada",
    subscription_expired: "Assinatura expirada",
    subscription_paused: "Assinatura pausada",
    not_found: "Cartão não encontrado",
    invalid_token: "Token inválido",
  };

  const tenantBelongsToUser = data?.tenant_id && user?.id && data.tenant_id === user.id;

  return (
    <div className="min-h-screen bg-[#05070d] text-white p-4 grid place-items-center">
      <div className="w-full max-w-md space-y-4">
        <div className={cn(
          "rounded-3xl border-2 p-6 bg-gradient-to-br to-black/40",
          tone.border, tone.bg,
        )}>
          <div className="flex items-center gap-3">
            <tone.Icon className={cn("h-12 w-12", tone.text)} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black">Resultado</p>
              <p className={cn("text-xl font-black", tone.text)}>{tone.label}</p>
            </div>
          </div>
          {data?.reason && reasonLabel[data.reason] && (
            <p className="mt-3 text-sm text-zinc-300">{reasonLabel[data.reason]}</p>
          )}
        </div>

        {customer && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0f17] p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-gold to-[#8a6d12] grid place-items-center text-black font-black text-xl overflow-hidden">
                {customer.avatar_url ? (
                  <img src={customer.avatar_url} alt={customer.name} className="h-full w-full object-cover" />
                ) : (
                  (customer.name || "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="font-black text-lg truncate">{customer.name}</p>
                {customer.phone_masked && (
                  <p className="text-xs text-zinc-500">{customer.phone_masked}</p>
                )}
              </div>
            </div>

            {plan && (
              <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-gold" />
                  <p className="font-bold text-gold">{plan.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500 uppercase tracking-widest text-[10px]">Tipo</p>
                    <p className="text-white font-bold">{plan.plan_type}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 uppercase tracking-widest text-[10px]">Uso</p>
                    <p className="text-white font-bold">
                      {plan.usage_type === "unlimited"
                        ? "Ilimitado"
                        : `${data.uses_this_period || 0}/${plan.max_uses_per_month}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
                <p className="text-zinc-500 uppercase text-[10px] tracking-widest">Benefícios restantes</p>
                <p className="text-white font-black text-lg">
                  {data.remaining_uses === null || data.remaining_uses === undefined ? "∞" : data.remaining_uses}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
                <p className="text-zinc-500 uppercase text-[10px] tracking-widest">Último uso</p>
                <p className="text-white font-bold text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {data.last_use ? new Date(data.last_use).toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
            </div>

            {isValid && (
              <>
                {!user ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Entre como barbearia para validar o atendimento.
                  </p>
                ) : !tenantBelongsToUser ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Esta assinatura não pertence à sua barbearia.
                  </p>
                ) : (
                  <Button
                    onClick={consumeBenefit}
                    disabled={validating}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black uppercase tracking-widest"
                  >
                    {validating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Scissors className="h-4 w-4 mr-2" />
                    )}
                    Validar Atendimento
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        <Button variant="ghost" onClick={load} className="w-full text-zinc-400">
          Reler cartão
        </Button>
      </div>
    </div>
  );
}
