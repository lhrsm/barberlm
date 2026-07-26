import { Check, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Slot } from "./appointment-utils";
import { cn } from "@/lib/utils";

const PERIOD_LABEL: Record<Slot["period"], string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

interface Props {
  slots: Slot[];
  value: string;
  onSelect: (time: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function AvailableSlotsGrid({ slots, value, onSelect, loading, error }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhum horário configurado para este profissional nesta data.
      </p>
    );
  }

  const periods: Slot["period"][] = ["morning", "afternoon", "evening"];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {periods.map((p) => {
          const group = slots.filter((s) => s.period === p);
          if (group.length === 0) return null;
          return (
            <div key={p} className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {PERIOD_LABEL[p]}
              </h4>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.map((slot) => {
                  const disabled = slot.state !== "available";
                  const selected = value === slot.time;
                  const tip =
                    slot.state === "busy"
                      ? "Já existe um atendimento neste período"
                      : slot.state === "overflow"
                        ? "O serviço ultrapassa o fim do expediente"
                        : slot.state === "past"
                          ? "Horário já passou"
                          : null;

                  const btn = (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={`Horário ${slot.time}${tip ? ` — ${tip}` : ""}`}
                      onClick={() => onSelect(slot.time)}
                      className={cn(
                        "flex h-10 w-full items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : disabled
                            ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground/60 line-through"
                            : "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5",
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      {disabled && !selected && <Lock className="h-3 w-3" />}
                      {slot.time}
                    </button>
                  );

                  return tip ? (
                    <Tooltip key={slot.time}>
                      <TooltipTrigger asChild>
                        <span className="block">{btn}</span>
                      </TooltipTrigger>
                      <TooltipContent>{tip}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span key={slot.time} className="block">
                      {btn}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    </TooltipProvider>
  );
}
