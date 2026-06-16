import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const barbexBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
  {
    variants: {
      status: {
        active: "bg-[#16A34A]/15 text-[#4ADE80] border-[#16A34A]/30",
        inactive: "bg-slate-500/15 text-slate-400 border-slate-500/30",
        canceled: "bg-[#DC2626]/15 text-[#F87171] border-[#DC2626]/30",
        pending: "bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30",
        paid: "bg-[#16A34A]/15 text-[#4ADE80] border-[#16A34A]/30",
        completed: "bg-[#16A34A]/15 text-[#4ADE80] border-[#16A34A]/30",
      },
    },
    defaultVariants: { status: "active" },
  }
);

export interface BarbexBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof barbexBadgeVariants> {}

export const BarbexBadge = React.forwardRef<HTMLSpanElement, BarbexBadgeProps>(
  ({ className, status, ...props }, ref) => (
    <span ref={ref} className={cn(barbexBadgeVariants({ status, className }))} {...props} />
  )
);
BarbexBadge.displayName = "BarbexBadge";
