import * as React from "react";
import { cn } from "@/lib/utils";

export const BarbexInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-xl bg-[#0B1220] border border-white/[0.08] px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all duration-200",
      "focus:outline-none focus:border-[#F59E0B] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      className
    )}
    {...props}
  />
));
BarbexInput.displayName = "BarbexInput";
