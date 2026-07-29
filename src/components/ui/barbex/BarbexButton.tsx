import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const barbexButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold uppercase tracking-wider transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background shadow-soft",
  {
    variants: {
      variant: {
        primary: "bg-gradient-gold text-gold-foreground shadow-gold hover:brightness-105",
        secondary: "bg-surface-raised text-foreground hover:bg-surface-raised/80",
        success: "bg-success text-success-foreground hover:brightness-110",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        outline: "bg-transparent border border-gold/60 text-gold hover:bg-gold/10",
      },
      size: {
        small: "h-9 px-4 text-[11px]",
        medium: "h-11 px-5 text-xs",
        large: "h-12 px-6 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "medium" },
  }
);


export interface BarbexButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof barbexButtonVariants> {
  asChild?: boolean;
}

export const BarbexButton = React.forwardRef<HTMLButtonElement, BarbexButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(barbexButtonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
BarbexButton.displayName = "BarbexButton";

export { barbexButtonVariants };
