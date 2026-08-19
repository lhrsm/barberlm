import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white shadow-sm transition-all duration-200",
          "placeholder:text-slate-500",
          "hover:border-white/20 hover:bg-white/10",
          "focus-visible:outline-none focus-visible:border-gold focus-visible:ring-4 focus-visible:ring-gold/10 focus-visible:bg-[#151D2C] focus-visible:text-white focus-visible:placeholder:text-[#6B7280]",
          "autofill:shadow-[0_0_0_1000px_#151D2C_inset] autofill:text-white [-webkit-text-fill-color:inherit]",
          "[[data-state=open]_&]:text-[#111111] [[data-state=open]_&]:bg-white", // Target for when parent is focus-within or similar if needed
          "[&:not(:placeholder-shown)]:text-white focus:[&:not(:placeholder-shown)]:text-[#111111]",
          "disabled:cursor-not-allowed disabled:opacity-50 text-base md:text-sm", // Ensure 16px to avoid iOS zoom
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
