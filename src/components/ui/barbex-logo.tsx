import { cn } from "@/lib/utils";
import logoData from "@/assets/logo-barbex.png.asset.json";

interface BarbexLogoProps {
  className?: string;
  variant?: "horizontal" | "symbol";
  theme?: "light" | "dark" | "gold";
  size?: "sm" | "md" | "lg" | "xl";
}

export function BarbexLogo({ 
  className, 
  variant = "horizontal", 
  theme = "gold",
  size = "md" 
}: BarbexLogoProps) {
  const sizes = {
    sm: variant === "symbol" ? "h-6 w-6" : "h-6",
    md: variant === "symbol" ? "h-10 w-10" : "h-10",
    lg: variant === "symbol" ? "h-16 w-16" : "h-16",
    xl: variant === "symbol" ? "h-24 w-24" : "h-24",
  };

  return (
    <div className={cn("relative flex items-center select-none", className)}>
      <img 
        src={logoData.url} 
        alt="Barbex Logo" 
        className={cn(
          "object-contain transition-all duration-300",
          sizes[size],
          theme === "dark" && "brightness-0",
          theme === "light" && "brightness-0 invert",
          theme === "gold" && "drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]"
        )}
        draggable={false}
      />
    </div>
  );
}

