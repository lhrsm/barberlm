import * as React from "react";
import { cn } from "@/lib/utils";

export const BarbexTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[120px] w-full rounded-xl bg-[#0B1220] border border-white/[0.08] p-4 text-sm text-white placeholder:text-slate-500 transition-all duration-200 resize-y",
      "focus:outline-none focus:border-[#F59E0B] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
BarbexTextarea.displayName = "BarbexTextarea";
