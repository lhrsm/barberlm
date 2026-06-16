import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const BarbexTabs = TabsPrimitive.Root;

export const BarbexTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-xl bg-[#0B1220] border border-white/[0.08] p-1",
      className
    )}
    {...props}
  />
));
BarbexTabsList.displayName = "BarbexTabsList";

export const BarbexTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold uppercase tracking-wider transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/40",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white data-[state=active]:shadow-sm",
      "data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-white/5 data-[state=inactive]:hover:text-white",
      className
    )}
    {...props}
  />
));
BarbexTabsTrigger.displayName = "BarbexTabsTrigger";

export const BarbexTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none", className)}
    {...props}
  />
));
BarbexTabsContent.displayName = "BarbexTabsContent";
