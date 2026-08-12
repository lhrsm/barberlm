
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export type BarbexLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Escala AUMENTADA da logo existente.
 * (mesmos nomes de tamanho — apenas maiores)
 */
const SIZES: Record<
  BarbexLogoSize,
  { box: string; icon: number; text: string; gap: string; radius: string }
> = {
  xs: { box: "h-12 w-12", icon: 24, text: "text-xl", gap: "gap-2", radius: "rounded-xl" },
  sm: { box: "h-16 w-16", icon: 32, text: "text-3xl", gap: "gap-3", radius: "rounded-2xl" },
  md: { box: "h-20 w-20", icon: 40, text: "text-4xl", gap: "gap-3.5", radius: "rounded-[1.25rem]" },
  lg: { box: "h-28 w-28", icon: 56, text: "text-5xl", gap: "gap-4", radius: "rounded-[1.6rem]" },
  xl: { box: "h-36 w-36", icon: 72, text: "text-6xl", gap: "gap-5", radius: "rounded-[2rem]" },
  "2xl": { box: "h-48 w-48", icon: 96, text: "text-7xl", gap: "gap-6", radius: "rounded-[2.5rem]" },
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
          "ring-1 ring-inset ring-white/25 shadow-[0_14px_38px_-14px_rgba(212,175,55,0.9)]",
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
