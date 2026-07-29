import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-hairline bg-surface-sunken/60 px-3.5 py-2.5 text-base text-foreground shadow-soft transition-colors placeholder:text-muted-foreground hover:border-gold/30 focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-2 focus-visible:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,

        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
