import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { brl } from "./engine";

export const GOLD = "#D4AF37";
export const EMERALD = "#10b981";
export const ROSE = "#f43f5e";
export const SKY = "#38bdf8";
export const VIOLET = "#a78bfa";
export const AMBER = "#f59e0b";
export const SLATE = "#94a3b8";
export const CHART_COLORS = [GOLD, EMERALD, SKY, VIOLET, AMBER, ROSE, SLATE];

export function ErpSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border bg-card shadow-sm animate-in fade-in-50 duration-300", className)}>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function ErpMetricCard({
  label,
  value,
  icon: Icon,
  variation,
  hint,
  tone = "neutral",
  loading,
  footer,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  variation?: number | null;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "gold";
  loading?: boolean;
  footer?: string;
}) {
  const toneRing =
    tone === "positive"
      ? "border-emerald-500/30"
      : tone === "negative"
        ? "border-rose-500/30"
        : tone === "gold"
          ? "border-[rgba(212,175,55,0.35)]"
          : "border-border";

  const toneIcon =
    tone === "positive"
      ? "bg-emerald-500/10 text-emerald-500"
      : tone === "negative"
        ? "bg-rose-500/10 text-rose-500"
        : tone === "gold"
          ? "bg-[rgba(212,175,55,0.12)] text-[#D4AF37]"
          : "bg-primary/10 text-primary";

  const VarIcon = variation == null ? Minus : variation >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <TooltipProvider delayDuration={150}>
      <Card
        className={cn(
          "group relative overflow-hidden bg-card shadow-sm transition-all duration-300",
          "hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-[0_20px_40px_-20px_rgba(212,175,55,0.2)]",
          toneRing,
        )}
      >

        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
              {hint && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Sobre ${label}`}
                      className="rounded-full p-0.5 text-muted-foreground/70 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">{hint}</TooltipContent>
                </Tooltip>
              )}
            </div>
            {Icon && (
              <span className={cn("rounded-lg p-2 transition-transform duration-300 group-hover:scale-110", toneIcon)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <p className="text-2xl font-black tabular-nums tracking-tight text-white">{value}</p>
          )}

          <div className="flex items-center justify-between gap-2 text-[11px]">
            {variation !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                  variation == null
                    ? "bg-muted text-muted-foreground"
                    : variation >= 0
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-rose-500/10 text-rose-500",
                )}
              >
                <VarIcon className="h-3 w-3" aria-hidden="true" />
                {variation == null ? "sem base" : `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`}
              </span>
            )}
            {footer && <span className="truncate text-muted-foreground">{footer}</span>}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export function MiniStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-[rgba(212,175,55,0.4)]">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
      {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function RankingList({
  items,
  emptyLabel = "Sem dados no período",
  suffix,
}: {
  items: { name: string; value: number; count?: number }[];
  emptyLabel?: string;
  suffix?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-foreground">{item.name}</span>
            <span className="shrink-0 font-bold tabular-nums text-foreground">
              {brl(item.value)}
              {suffix ? <span className="ml-1 text-xs text-muted-foreground">{suffix}</span> : null}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D062] transition-all duration-500"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
          </div>
          {item.count != null && (
            <p className="text-[11px] text-muted-foreground">{item.count} registro(s)</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ErpSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-border bg-card">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
