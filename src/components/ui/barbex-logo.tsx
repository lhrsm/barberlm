import { cn } from "@/lib/utils";
import logoData from "@/assets/logo-barbex.png.asset.json";

export type BarbexLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZES: Record<
  BarbexLogoSize,
  { box: string; text: string; gap: string }
> = {
  xs: { box: "h-10", text: "text-lg", gap: "gap-2" },
  sm: { box: "h-12", text: "text-xl", gap: "gap-2.5" },
  md: { box: "h-14", text: "text-2xl", gap: "gap-3" },
  lg: { box: "h-32 md:h-44", text: "text-4xl", gap: "gap-4" },
  xl: { box: "h-44 md:h-56", text: "text-5xl", gap: "gap-5" },
  "2xl": { box: "h-32 md:h-44", text: "text-7xl", gap: "gap-6" },
};

interface BarbexLogoProps {
  /** Tamanho da logo */
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
      <img
        src={logoData.url}
        alt="Barbex Logo"
        className={cn("w-auto object-contain", s.box, markClassName)}
      />

      {showText && (
        <span
          className={cn(
            "font-black uppercase italic tracking-tighter leading-none text-white transition-opacity duration-300",
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