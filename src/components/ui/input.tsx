import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-hairline bg-white px-4 py-2 text-base text-black shadow-sm transition-all duration-200",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-zinc-400",
          "hover:border-gold/40 hover:bg-zinc-50/50",
          "focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-4 focus-visible:ring-gold/10 focus-visible:bg-white",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
