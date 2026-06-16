import * as React from "react";
import { cn } from "@/lib/utils";

interface BarbexPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const BarbexPageHeader = React.forwardRef<HTMLDivElement, BarbexPageHeaderProps>(
  ({ className, title, subtitle, actions, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-6 mb-6 border-b border-white/5",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-400 font-medium">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
);
BarbexPageHeader.displayName = "BarbexPageHeader";
