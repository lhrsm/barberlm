import * as React from "react";
import { cn } from "@/lib/utils";

export const BarbexInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-xl bg-surface-sunken/60 border border-hairline px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200",
      "focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/30",
      "disabled:cursor-not-allowed disabled:opacity-50",

      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      className
    )}
    {...props}
  />
));
BarbexInput.displayName = "BarbexInput";
