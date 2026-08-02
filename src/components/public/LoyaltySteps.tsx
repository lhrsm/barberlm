import { memo } from "react";
import { cn } from "@/lib/utils";
import { Scissors, Gift } from "lucide-react";

interface Props {
  required?: number | null;
  benefit?: string | null;
}

/**
 * Trilha visual do programa de fidelidade (quantos atendimentos faltam
 * até a recompensa). Componente apenas de apresentação.
 */
export const LoyaltySteps = memo(function LoyaltySteps({ required, benefit }: Props) {
  const total = Math.min(Math.max(Number(required || 0), 0), 12);
  if (total < 2) return null;

  return (
    <div className="rounded-3xl border border-gold/20 bg-black/60 p-6">
      <p className="mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-gold">Sua trilha de recompensa</p>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-black",
                "border-white/15 bg-white/[0.03] text-white/70",
              )}
            >
              <Scissors size={13} aria-hidden />
            </div>
            {i < total - 1 && <span className="h-px w-4 bg-white/15" />}
          </div>
        ))}
        <span className="h-px w-4 bg-gold/50" />
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold bg-gold/15 text-gold shadow-[0_0_24px_rgba(212,175,55,0.25)]">
          <Gift size={18} aria-hidden />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-400">
        {total} atendimentos concluídos e você recebe{" "}
        <span className="font-bold text-white">{benefit || "uma recompensa especial"}</span>.
      </p>
    </div>
  );
});
