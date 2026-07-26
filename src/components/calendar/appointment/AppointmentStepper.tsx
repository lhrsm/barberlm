import { Check, User, CalendarDays, UserRound, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Serviço", Icon: User },
  { id: 2, label: "Data e horário", Icon: CalendarDays },
  { id: 3, label: "Cliente", Icon: UserRound },
  { id: 4, label: "Confirmação", Icon: ClipboardCheck },
];

export function AppointmentStepper({ current }: { current: number }) {
  const active = STEPS.find((s) => s.id === current);
  return (
    <div>
      {/* Mobile compacto */}
      <div className="sm:hidden" aria-hidden>
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>
            Etapa {current} de 4 — <span className="text-foreground">{active?.label}</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(current / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop */}
      <ol
        className="hidden items-center gap-2 sm:flex"
        aria-label={`Etapa ${current} de 4: ${active?.label}`}
      >
        {STEPS.map((step, i) => {
          const done = current > step.id;
          const isCurrent = current === step.id;
          const { Icon } = step;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-all",
                    done && "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-primary/10 text-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]",
                    !done && !isCurrent && "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    "truncate text-xs",
                    isCurrent ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {step.id}. {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1 rounded-full",
                    done ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
