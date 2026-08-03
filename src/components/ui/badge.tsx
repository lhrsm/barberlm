import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-soft hover:brightness-110 transition-all",
        gold: "border-gold/30 bg-gold/10 text-gold shadow-[0_0_12px_-4px_rgba(212,175,55,0.3)]",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-soft hover:brightness-110",
        success: "border-success/30 bg-success/10 text-success px-3",
        warning: "border-warning/30 bg-warning/10 text-warning px-3",
        info: "border-info/30 bg-info/10 text-info px-3",
        outline: "border-hairline text-muted-foreground hover:text-foreground hover:border-gold/30 transition-colors",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);


export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
