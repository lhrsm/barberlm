import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const barbexBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
  {
    variants: {
      status: {
        active: "bg-success/15 text-success border-success/30",
        inactive: "bg-muted text-muted-foreground border-hairline",
        canceled: "bg-destructive/15 text-destructive border-destructive/30",
        pending: "bg-warning/15 text-warning border-warning/30",
        paid: "bg-success/15 text-success border-success/30",
        completed: "bg-success/15 text-success border-success/30",

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
