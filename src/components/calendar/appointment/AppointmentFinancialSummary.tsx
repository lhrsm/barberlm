import { formatBRL, type FinancialBreakdown } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  breakdown: FinancialBreakdown;
  className?: string;
}

function Row({
  label,
  value,
  negative,
  strong,
}: {
  label: string;
  value: string;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={cn("text-sm", strong ? "font-bold text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          strong ? "text-lg font-black text-foreground" : "text-foreground",
          negative && "text-emerald-600",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function AppointmentFinancialSummary({ breakdown, className }: Props) {
  const b = breakdown;
  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}
      aria-label="Resumo financeiro"
    >
      <h3 className="mb-2 text-sm font-black text-foreground">Resumo financeiro</h3>
      <div className="divide-y divide-border/70">
        <Row label="Valor do serviço" value={formatBRL(b.servicePrice)} />
        <Row label="Produtos" value={formatBRL(b.products)} />
        <Row label="Adicionais" value={formatBRL(b.extras)} />
        <Row label="Descontos" value={`-${formatBRL(b.discounts)}`} negative={b.discounts > 0} />
        <Row
          label="Créditos utilizados"
          value={`-${formatBRL(b.creditsUsed)}`}
          negative={b.creditsUsed > 0}
        />
        <Row
          label="Cashback utilizado"
          value={`-${formatBRL(b.cashbackUsed)}`}
          negative={b.cashbackUsed > 0}
        />
        <div className="pt-1">
          <Row label="Total do atendimento" value={formatBRL(b.total)} strong />
        </div>
      </div>
    </section>
  );
}
