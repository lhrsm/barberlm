import * as React from "react";
import { cn } from "@/lib/utils";

export const BarbexCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl bg-[#0B1220] border border-[#F59E0B]/[0.12] p-6 transition-all duration-200",
      "hover:border-[#F59E0B]/30",
      className
    )}
    {...props}
  />
));
BarbexCard.displayName = "BarbexCard";

export const BarbexCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 mb-4", className)} {...props} />
));
BarbexCardHeader.displayName = "BarbexCardHeader";

export const BarbexCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-black uppercase tracking-wider text-white", className)}
    {...props}
  />
));
BarbexCardTitle.displayName = "BarbexCardTitle";

export const BarbexCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-slate-400", className)} {...props} />
));
BarbexCardDescription.displayName = "BarbexCardDescription";

export const BarbexCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-4", className)} {...props} />
));
BarbexCardContent.displayName = "BarbexCardContent";

export const BarbexCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center justify-end gap-2 mt-6 pt-4 border-t border-white/5", className)} {...props} />
));
BarbexCardFooter.displayName = "BarbexCardFooter";
