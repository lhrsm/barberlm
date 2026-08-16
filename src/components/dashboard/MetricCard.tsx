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
    ring: "border-amber-500/10 hover:border-amber-500/30",
    glow: "bg-amber-500/10",
    icon: "bg-amber-500/10 text-amber-400",
    value: "text-amber-300",
  },
  emerald: {
    ring: "border-emerald-500/10 hover:border-emerald-500/30",
    glow: "bg-emerald-500/10",
    icon: "bg-emerald-500/10 text-emerald-400",
    value: "text-emerald-300",
  },
  blue: {
    ring: "border-sky-500/10 hover:border-sky-500/30",
    glow: "bg-sky-500/10",
    icon: "bg-sky-500/10 text-sky-400",
    value: "text-sky-300",
  },
  purple: {
    ring: "border-purple-500/10 hover:border-purple-500/30",
    glow: "bg-purple-500/10",
    icon: "bg-purple-500/10 text-purple-400",
    value: "text-purple-300",
  },
  orange: {
    ring: "border-orange-500/10 hover:border-orange-500/30",
    glow: "bg-orange-500/10",
    icon: "bg-orange-500/10 text-orange-400",
    value: "text-orange-300",
  },
  indigo: {
    ring: "border-indigo-500/10 hover:border-indigo-500/30",
    glow: "bg-indigo-500/10",
    icon: "bg-indigo-500/10 text-indigo-400",
    value: "text-indigo-300",
  },
  neutral: {
    ring: "border-white/5 hover:border-white/20",
    glow: "bg-white/5",
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
        "group relative flex h-full min-h-[140px] flex-col justify-between overflow-hidden rounded-3xl border bg-[#0b0f17]/40 p-6 backdrop-blur-sm",
        "transition-all duration-300 hover:-translate-y-1 hover:bg-[#0b0f17]/60 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]",
        t.ring,
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-[64px] transition-opacity duration-500 group-hover:opacity-100",
          t.glow,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-400 transition-colors">
          {label}
        </p>
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all duration-300 group-hover:scale-110", 
          t.icon, 
          tone === "neutral" ? "border-white/5" : "border-current/20"
        )}>
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </div>
      </div>

      <div className="relative mt-4">
        {loading ? (
          <div className="h-8 w-28 animate-pulse rounded-lg bg-white/5" />
        ) : (
          <p className={cn("truncate text-3xl font-black tracking-tight", t.value)}>
            {value}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {trend != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest",
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
          ) : hint ? (
            <p className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-400 transition-colors">{hint}</p>
          ) : null}
        </div>

        {children && <div className="mt-4 border-t border-white/5 pt-3">{children}</div>}
      </div>
    </div>
  );
}