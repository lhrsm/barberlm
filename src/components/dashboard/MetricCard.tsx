import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTone =
  | "gold"
  | "emerald"
  | "blue"
  | "purple"
  | "orange"
  | "indigo"
  | "neutral";

const TONE: Record<MetricTone, { ring: string; glow: string; icon: string; value: string }> = {
  gold: {
    ring: "border-amber-500/25 hover:border-amber-400/50",
    glow: "bg-amber-500/20",
    icon: "bg-amber-500/10 text-amber-400",
    value: "text-amber-300",
  },
  emerald: {
    ring: "border-emerald-500/25 hover:border-emerald-400/50",
    glow: "bg-emerald-500/20",
    icon: "bg-emerald-500/10 text-emerald-400",
    value: "text-emerald-300",
  },
  blue: {
    ring: "border-sky-500/25 hover:border-sky-400/50",
    glow: "bg-sky-500/20",
    icon: "bg-sky-500/10 text-sky-400",
    value: "text-sky-300",
  },
  purple: {
    ring: "border-purple-500/25 hover:border-purple-400/50",
    glow: "bg-purple-500/20",
    icon: "bg-purple-500/10 text-purple-400",
    value: "text-purple-300",
  },
  orange: {
    ring: "border-orange-500/25 hover:border-orange-400/50",
    glow: "bg-orange-500/20",
    icon: "bg-orange-500/10 text-orange-400",
    value: "text-orange-300",
  },
  indigo: {
    ring: "border-indigo-500/25 hover:border-indigo-400/50",
    glow: "bg-indigo-500/20",
    icon: "bg-indigo-500/10 text-indigo-400",
    value: "text-indigo-300",
  },
  neutral: {
    ring: "border-white/10 hover:border-white/25",
    glow: "bg-white/10",
    icon: "bg-white/5 text-zinc-300",
    value: "text-white",
  },
};

export interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  /** Variação percentual vs. período anterior (opcional, apenas exibição). */
  trend?: number | null;
  trendLabel?: string;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  trend = null,
  trendLabel,
  loading = false,
  className,
  children,
}: MetricCardProps) {
  const t = TONE[tone];
  const TrendIcon = trend == null ? Minus : trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;

  return (
    <div
      className={cn(
        "group relative flex h-full min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border bg-[#0b0f17]/80 p-5 backdrop-blur",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]",
        "focus-within:ring-2 focus-within:ring-amber-400/60",
        t.ring,
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-[48px] transition-opacity duration-500 group-hover:opacity-100",
          t.glow,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
          {label}
        </p>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", t.icon)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="relative mt-3">
        {loading ? (
          <div className="h-8 w-28 animate-pulse rounded-lg bg-white/10" />
        ) : (
          <p className={cn("truncate text-2xl font-black tracking-tight md:text-[26px]", t.value)}>
            {value}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {hint && <p className="text-[11px] font-medium text-zinc-500">{hint}</p>}
          {trend != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black",
                trend > 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : trend < 0
                    ? "bg-rose-500/10 text-rose-400"
                    : "bg-white/5 text-zinc-400",
              )}
              title={trendLabel || "Comparado à média"}
            >
              <TrendIcon className="h-3 w-3" aria-hidden />
              {Math.abs(trend).toFixed(1)}% {trendLabel || "vs média"}
            </span>
          )}
        </div>

        {children && <div className="mt-3 border-t border-white/5 pt-2">{children}</div>}
      </div>
    </div>
  );
}
