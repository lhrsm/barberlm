import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Crown, Scissors, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string | null;
  usedLabel?: string; // "8/8 utilizados"
  renewalDate?: Date | null;
  reason?: "empty" | "combo";
  serviceName?: string | null;
  onChangePlan: () => void;
  onPayStandalone: () => void;
};

export function ExhaustedUsesModal({
  open,
  onOpenChange,
  planName,
  usedLabel,
  renewalDate,
  reason = "empty",
  serviceName,
  onChangePlan,
  onPayStandalone,
}: Props) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[71] w-[94vw] max-w-[460px] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl overflow-hidden border-2 border-gold/50",
            "bg-gradient-to-br from-[#0a0a0a] via-[#160f04] to-[#0a0a0a] text-white",
            "shadow-[0_20px_60px_rgba(212,175,55,0.25)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gold/10 blur-3xl pointer-events-none" />

          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 grid place-items-center shadow-lg shrink-0">
                <AlertTriangle className="h-6 w-6 text-black" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">
                  Assinatura Premium
                </p>
                <DialogPrimitive.Title className="text-xl font-black text-white leading-tight">
                  Utilizações esgotadas
                </DialogPrimitive.Title>
              </div>
            </div>

            <DialogPrimitive.Description className="text-sm text-gray-300 leading-relaxed">
              {reason === "combo" ? (
                <>
                  O serviço <span className="font-bold text-white">{serviceName || "escolhido"}</span> exige
                  mais utilizações do que você possui disponíveis neste ciclo.
                </>
              ) : (
                <>Você já utilizou todos os benefícios disponíveis no seu plano neste ciclo.</>
              )}
            </DialogPrimitive.Description>

            <div className="mt-4 rounded-xl border border-gold/25 bg-black/40 p-4 space-y-2">
              {planName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 uppercase tracking-widest font-bold">Plano</span>
                  <span className="text-white font-bold">{planName}</span>
                </div>
              )}
              {usedLabel && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 uppercase tracking-widest font-bold">Usos do ciclo</span>
                  <span className="text-gold font-black">{usedLabel}</span>
                </div>
              )}
              {renewalDate && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 uppercase tracking-widest font-bold">Renovação</span>
                  <span className="text-white font-bold">
                    {format(renewalDate, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-400 mt-3 leading-snug">
              Você pode fazer upgrade do seu plano para ganhar mais utilizações, ou continuar agendando
              normalmente pagando avulso.
            </p>

            <div className="mt-5 grid gap-2.5">
              <button
                type="button"
                onClick={onChangePlan}
                className="h-12 rounded-xl bg-gradient-to-r from-gold to-[#F5D061] text-black font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(212,175,55,0.35)] hover:brightness-110 hover:-translate-y-0.5 transition-all"
              >
                <Crown className="h-4 w-4" /> Mudar de Plano
              </button>
              <button
                type="button"
                onClick={onPayStandalone}
                className="h-12 rounded-xl border border-white/20 bg-white/5 text-white font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/40 transition-all"
              >
                <Scissors className="h-4 w-4" /> Pagar Avulso
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
