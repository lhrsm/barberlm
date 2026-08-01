import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { fmtBRL } from "./engine";

export const GOLD = "#D4AF37";

export function SectionTitle({
  title,
  subtitle,
  icon: Icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="h-9 w-9 shrink-0 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 grid place-items-center">
            <Icon className="h-4 w-4 text-[#D4AF37]" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-black text-white truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-zinc-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800/80 bg-[#0b0f17]/90 p-4 sm:p-5 backdrop-blur transition-colors hover:border-[#D4AF37]/25",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DeltaPill({ value }: { value: number }) {
  const neutral = Math.abs(value) < 0.05;
  const up = value >= 0;
  const Icon = neutral ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
        neutral
          ? "border-zinc-700 bg-zinc-800/50 text-zinc-400"
          : up
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {neutral ? "estável" : `${Math.abs(value).toFixed(1)}%`}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tooltip,
  delta,
  icon: Icon,
  loading,
  accent = "gold",
}: {
  label: string;
  value: string;
  hint?: string;
  tooltip?: string;
  delta?: number;
  icon?: any;
  loading?: boolean;
  accent?: "gold" | "emerald" | "sky" | "amber" | "violet";
}) {
  const accents: Record<string, string> = {
    gold: "text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/25",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/25",
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0b0f17] p-4 sm:p-5">
        <Skeleton className="h-3 w-24 bg-zinc-800" />
        <Skeleton className="mt-3 h-7 w-32 bg-zinc-800" />
        <Skeleton className="mt-2 h-3 w-20 bg-zinc-800" />
      </div>
    );
  }

  const card = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#0b0f17] p-4 sm:p-5",
        "transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/40 hover:shadow-[0_10px_30px_-12px_rgba(212,175,55,0.35)]",
        "focus-within:border-[#D4AF37]/40",
      )}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {label}
        </span>
        <div
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl border",
            accents[accent],
          )}
        >
          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : <Info className="h-4 w-4" />}
        </div>
      </div>
      <div className="mt-2 truncate text-xl font-black tracking-tight text-white sm:text-2xl">
        {value}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {typeof delta === "number" && <DeltaPill value={delta} />}
        {hint && <span className="truncate text-[11px] text-zinc-500">{hint}</span>}
      </div>
    </div>
  );

  if (!tooltip) return card;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div tabIndex={0} aria-label={`${label}: ${value}`} className="outline-none rounded-2xl focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60">
            {card}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] border-zinc-800 bg-[#0b0f17] text-zinc-200">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "gold" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    default: "text-white",
    gold: "text-[#D4AF37]",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
  };
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-[#05070d]/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div className={cn("mt-1 truncate text-sm font-black", tones[tone])}>
        {value}
      </div>
    </div>
  );
}

export function RankingList({
  items,
  emptyLabel = "Sem dados no período",
}: {
  items: { name: string; value: number; secondary?: string; ratio: number }[];
  emptyLabel?: string;
}) {
  if (!items.length)
    return <p className="py-8 text-center text-sm text-zinc-500">{emptyLabel}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={`${it.name}-${i}`} className="group">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-zinc-700 bg-zinc-900 text-[10px] font-black text-zinc-400">
                {i + 1}
              </span>
              <span className="truncate font-bold text-white">{it.name}</span>
            </span>
            <span className="shrink-0 font-black text-[#D4AF37]">
              {fmtBRL(it.value)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-amber-300 transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, it.ratio * 100))}%` }}
            />
          </div>
          {it.secondary && (
            <div className="mt-1 text-[11px] text-zinc-500">{it.secondary}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ChartFrame({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <Panel>
      <div className="mb-3">
        <h4 className="text-sm font-black uppercase tracking-wider text-zinc-300">
          {title}
        </h4>
        {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </Panel>
  );
}

export function PanelSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0b0f17] p-5">
      <Skeleton className="h-4 w-40 bg-zinc-800" />
      <Skeleton className="mt-4 w-full bg-zinc-800" style={{ height }} />
    </div>
  );
}
