import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export const money = (n: number) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6",
        "transition-colors hover:border-[#D4AF37]/25",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h3 className="text-base sm:text-lg font-black text-foreground">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  tooltip,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  delta?: number | null;
  tooltip?: string;
  loading?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/40",
        "hover:shadow-[0_16px_40px_-20px_rgba(212,175,55,0.5)]",
      )}
    >
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-[#D4AF37]" />}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-28" />
      ) : (
        <p className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-foreground">{value}</p>
      )}
      <div className="mt-1 flex items-center gap-2">
        {typeof delta === "number" && (
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-black",
              delta >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );

  if (!tooltip) return body;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div tabIndex={0} aria-label={`${label}: ${value}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60 rounded-2xl">
            {body}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RankRow({
  index,
  title,
  subtitle,
  value,
  progress,
}: {
  index: number;
  title: string;
  subtitle?: string;
  value: string;
  progress?: number;
}) {
  return (
    <li className="group rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-[#D4AF37]/30">
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#D4AF37]/15 text-[11px] font-black text-[#D4AF37]">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <span className="shrink-0 text-sm font-black text-[#D4AF37]">{value}</span>
      </div>
      {typeof progress === "number" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061] transition-all duration-700"
            style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </li>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}
