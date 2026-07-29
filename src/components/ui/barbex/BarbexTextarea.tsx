import * as React from "react";
import { cn } from "@/lib/utils";

export const BarbexTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[120px] w-full resize-y rounded-xl border border-border bg-surface-sunken p-4 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground",
      "focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/35",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
BarbexTextarea.displayName = "BarbexTextarea";
