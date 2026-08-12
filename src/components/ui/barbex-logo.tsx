import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export type BarbexLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZES: Record<
  BarbexLogoSize,
  { box: string; icon: number; text: string; gap: string; radius: string }
> = {
  xs: { box: "h-9 w-9", icon: 18, text: "text-lg", gap: "gap-2", radius: "rounded-lg" },
  sm: { box: "h-12 w-12", icon: 24, text: "text-2xl", gap: "gap-2.5", radius: "rounded-xl" },
  md: { box: "h-16 w-16", icon: 32, text: "text-3xl", gap: "gap-3", radius: "rounded-2xl" },
  lg: { box: "h-24 w-24", icon: 46, text: "text-5xl", gap: "gap-4", radius: "rounded-[1.4rem]" },
  xl: { box: "h-32 w-32", icon: 62, text: "text-6xl", gap: "gap-5", radius: "rounded-[1.75rem]" },
  "2xl": { box: "h-40 w-40", icon: 78, text: "text-7xl", gap: "gap-6", radius: "rounded-[2rem]" },
};

interface BarbexLogoProps {
  /** Tamanho da logo (escala aumentada) */
  size?: BarbexLogoSize;
  /** Exibe o wordmark ao lado do símbolo */
  showText?: boolean;
  /** Texto customizado (padrão: BARBEX) */
  text?: string;
  className?: string;
  textClassName?: string;
  markClassName?: string;
}

export function BarbexLogo({
  size = "md",
  showText = true,
  text = "BARBEX",
  className,
  textClassName,
  markClassName,
}: BarbexLogoProps) {
  const s = SIZES[size] ?? SIZES.md;

  return (
    <div className={cn("inline-flex items-center", s.gap, className)}>
      <div
        className={cn(
          "relative shrink-0 flex items-center justify-center overflow-hidden",
          s.box,
          s.radius,
          "bg-[linear-gradient(135deg,#F5D77A_0%,#D4AF37_50%,#b8860b_100%)]",
          "ring-1 ring-inset ring-white/25 shadow-[0_10px_30px_-12px_rgba(212,175,55,0.85)]",
          markClassName
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.45)_50%,transparent_65%)]" />
        <Scissors size={s.icon} className="relative text-black" strokeWidth={2.4} />
      </div>

      {showText && (
        <span
          className={cn(
            "font-black uppercase italic tracking-tighter leading-none",
            "bg-[linear-gradient(110deg,#F5D77A_0%,#D4AF37_45%,#ea580c_100%)] bg-clip-text text-transparent",
            s.text,
            textClassName
          )}
        >
          {text}
        </span>
      )}
    </div>
  );
}

export default BarbexLogo;
