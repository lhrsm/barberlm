import { useMemo, useState } from "react";
import { calendarData, brl } from "./engine";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ErpFinancialCalendar({
  transactions,
  appointments,
  subscriptions,
}: {
  transactions: any[];
  appointments: any[];
  subscriptions: any[];
}) {
  const [month, setMonth] = useState(() => new Date());

  const days = useMemo(
    () => calendarData({ transactions, appointments, subscriptions, month }),
    [transactions, appointments, subscriptions, month],
  );

  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const monthLabel = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const totals = days.reduce(
    (a, d) => ({
      income: a.income + d.income,
      expense: a.expense + d.expense,
      expected: a.expected + d.expectedIncome,
      renewals: a.renewals + d.renewals,
    }),
    { income: 0, expense: 0, expected: 0, renewals: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-bold capitalize text-foreground">{monthLabel}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-emerald-500">Entradas {brl(totals.income)}</span>
          <span className="text-rose-500">Saídas {brl(totals.expense)}</span>
          <span className="text-[#D4AF37]">Previsto {brl(totals.expected)}</span>
          <span className="text-muted-foreground">{totals.renewals} renovação(ões)</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[68px] rounded-lg bg-muted/20" />
        ))}
        {days.map((d) => {
          const balance = d.income - d.expense;
          const hasData = d.income > 0 || d.expense > 0 || d.expectedIncome > 0;
          return (
            <TooltipProvider key={d.date} delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    tabIndex={0}
                    role="button"
                    aria-label={`Dia ${d.day}: entradas ${brl(d.income)}, saídas ${brl(d.expense)}`}
                    className={cn(
                      "min-h-[68px] rounded-lg border p-1.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      hasData
                        ? "border-[rgba(212,175,55,0.28)] bg-background/60 hover:-translate-y-0.5 hover:border-[rgba(212,175,55,0.6)]"
                        : "border-border/50 bg-muted/10",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-foreground">{d.day}</span>
                      {d.renewals > 0 && (
                        <span className="rounded-full bg-[rgba(212,175,55,0.15)] px-1.5 text-[9px] font-bold text-[#D4AF37]">
                          {d.renewals}
                        </span>
                      )}
                    </div>
                    {d.income > 0 && (
                      <p className="truncate text-[10px] font-semibold text-emerald-500">+{brl(d.income)}</p>
                    )}
                    {d.expense > 0 && (
                      <p className="truncate text-[10px] font-semibold text-rose-500">-{brl(d.expense)}</p>
                    )}
                    {d.expectedIncome > 0 && (
                      <p className="truncate text-[10px] text-[#D4AF37]">~{brl(d.expectedIncome)}</p>
                    )}
                    {hasData && (
                      <p
                        className={cn(
                          "truncate text-[10px] font-bold",
                          balance >= 0 ? "text-foreground" : "text-rose-500",
                        )}
                      >
                        {brl(balance)}
                      </p>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p className="font-bold">Dia {d.day}</p>
                  <p>Entradas: {brl(d.income)}</p>
                  <p>Saídas: {brl(d.expense)}</p>
                  <p>Previsto: {brl(d.expectedIncome)}</p>
                  <p>Renovações: {d.renewals}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
