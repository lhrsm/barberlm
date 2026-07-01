import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Crown, Check, Sparkles, Calendar, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SubscriptionUsage } from "@/hooks/use-subscription-usage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: any;
  planServices: any[];
  usage: SubscriptionUsage;
  onChangePlan: () => void;
};

export function PlanDetailsModal({
  open,
  onOpenChange,
  subscription,
  planServices,
  usage,
  onChangePlan,
}: Props) {
  const plan = subscription?.plan || {};
  const included: string[] = Array.isArray(plan?.included_benefits)
    ? plan.included_benefits
    : [];
  const pendingPlanName: string | undefined = subscription?.metadata?.pending_plan_name;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-[640px] -translate-x-1/2 -translate-y-1/2",
            "rounded-3xl bg-gradient-to-br from-[#0B0B0B] via-[#111] to-black border border-[#D4AF37]/30 shadow-[0_20px_60px_-15px_rgba(212,175,55,0.4)]",
            "max-h-[92vh] overflow-hidden flex flex-col",
            "duration-250 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* HEADER */}
          <div className="relative px-6 sm:px-8 pt-7 pb-5 border-b border-white/5">
            <div className="flex items-start gap-4 pr-14">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-lg">
                <Crown className="h-6 w-6 text-black" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Detalhes do Plano
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-gray-400 mt-1">
                  Visualize seus benefícios, utilizações e renovação.
                </DialogPrimitive.Description>
              </div>
            </div>

            <DialogPrimitive.Close
              aria-label="Fechar"
              className={cn(
                "absolute right-5 top-5 h-10 w-10 rounded-full flex items-center justify-center",
                "bg-[#1A1A1A] border border-[#D4AF37]/50 text-white",
                "transition-all duration-250",
                "hover:bg-[#D4AF37] hover:text-black hover:scale-110 hover:border-[#D4AF37]",
                "focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50",
              )}
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* BODY */}
          <div className="px-6 sm:px-8 py-6 overflow-y-auto space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-[#D4AF37]/15 via-black/40 to-black border border-[#D4AF37]/30 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">
                    Plano Atual
                  </p>
                  <h3 className="text-2xl font-black text-white mt-1">{plan?.name || usage.plan_name}</h3>
                  <p className="text-3xl font-black text-[#D4AF37] mt-2">
                    R$ {Number(plan?.monthly_price || 0).toFixed(2).replace(".", ",")}
                    <span className="text-sm text-gray-400 font-bold">/mês</span>
                  </p>
                </div>
                <Badge className="bg-emerald-500 text-black font-black uppercase text-[10px]">Ativa</Badge>
              </div>

              {pendingPlanName && (
                <div className="mt-4 rounded-xl border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
                  <strong className="font-bold">Mudança agendada:</strong> seu plano mudará para{" "}
                  <strong>{pendingPlanName}</strong> na próxima renovação.
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Consumidas" value={`${usage.total_uses_consumed}`} hint={usage.has_limits ? `de ${usage.total_uses_allowed}` : "ilimitado"} />
              <Stat label="Cortes" value={`${usage.haircut_used}`} hint={usage.haircut_allowed ? `de ${usage.haircut_allowed}` : "—"} />
              <Stat label="Barbas" value={`${usage.beard_used}`} hint={usage.beard_allowed ? `de ${usage.beard_allowed}` : "—"} />
            </div>

            {usage.renewal_date && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                <div className="text-xs">
                  <span className="text-gray-400">Próxima renovação em </span>
                  <span className="text-white font-bold">
                    {format(usage.renewal_date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-white mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#D4AF37]" /> Benefícios inclusos
              </h4>
              <ul className="grid sm:grid-cols-2 gap-2">
                {included.length === 0 ? (
                  <li className="text-xs text-gray-500 italic col-span-2">Nenhum benefício cadastrado.</li>
                ) : (
                  included.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="mt-0.5 h-5 w-5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-[#D4AF37]" />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {planServices?.length > 0 && (
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white mb-3 flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-[#D4AF37]" /> Serviços inclusos
                </h4>
                <div className="flex flex-wrap gap-2">
                  {planServices.map((ps: any, i: number) => (
                    <span
                      key={i}
                      className="text-xs px-3 py-1.5 rounded-full bg-black/40 border border-[#D4AF37]/25 text-gray-200"
                    >
                      {ps?.services?.name || "Serviço"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FOOTER — sticky */}
          <div className="sticky bottom-0 px-6 sm:px-8 pt-5 pb-6 border-t border-[#D4AF37]/15 bg-gradient-to-b from-black/60 via-black/85 to-black flex flex-col gap-3 mt-auto">
            <button
              type="button"
              onClick={onChangePlan}
              className={cn(
                "w-full h-12 rounded-[14px] inline-flex items-center justify-center gap-2",
                "bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black font-bold text-[15px]",
                "shadow-[0_6px_20px_rgba(212,175,55,0.35)] transition-all duration-250 cursor-pointer",
                "hover:from-[#E6C24C] hover:to-[#FFDD75] hover:shadow-[0_12px_32px_rgba(212,175,55,0.55)] hover:-translate-y-0.5",
                "active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50",
              )}
            >
              <Crown className="h-4 w-4" /> Mudar de Plano
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                "w-full h-12 rounded-[14px] inline-flex items-center justify-center gap-2",
                "bg-transparent border border-[#D4AF37] text-white font-semibold text-[15px]",
                "transition-all duration-250 cursor-pointer",
                "hover:bg-[#D4AF37] hover:text-black hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(212,175,55,0.35)]",
                "[&:hover_svg]:text-black active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50",
              )}
            >
              <X className="h-4 w-4" /> Fechar
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center">
      <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">{label}</p>
      <p className="text-xl font-black text-white mt-1">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>
    </div>
  );
}
