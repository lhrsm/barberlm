import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const barbexButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold uppercase tracking-wider transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/40 shadow-sm",
  {
    variants: {
      variant: {
        primary: "bg-[#F59E0B] text-white hover:bg-[#F59E0B]/90 shadow-[0_4px_14px_-4px_rgba(245,158,11,0.4)]",
        secondary: "bg-white text-[#111827] hover:bg-white/90",
        success: "bg-[#16A34A] text-white hover:bg-[#16A34A]/90",
        danger: "bg-[#DC2626] text-white hover:bg-[#DC2626]/90",
        ghost: "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white",
        outline: "bg-transparent border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10",
      },
      size: {
        small: "h-9 px-4 text-[11px]",
        medium: "h-[42px] px-5 text-xs",
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
