import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Premium tabs inspired by the Mercado Pago mobile app:
 * - Tabs integrated into the top edge of a rounded dark card
 * - Active tab raised in white with rounded top corners
 * - Inactive tabs translucent
 * - Horizontal scroll on mobile, hidden scrollbar
 * - Smooth fade + horizontal slide between tab contents
 *
 * Usage:
 *   <PremiumTabs defaultValue="x">
 *     <PremiumTabsList
 *       tabs={[{ value: "x", label: "X", icon: Icon }]}
 *     />
 *     <PremiumTabsBody>
 *       <PremiumTabsContent value="x">...</PremiumTabsContent>
 *     </PremiumTabsBody>
 *   </PremiumTabs>
 */

export const PremiumTabs = TabsPrimitive.Root;

interface TabItem {
  value: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export const PremiumTabsList = React.forwardRef<
  HTMLDivElement,
  {
    tabs: TabItem[];
    className?: string;
  }
>(({ tabs, className }, ref) => (
  <div
    ref={ref}
    className={cn(
      "premium-tabs-scroll overflow-x-auto bg-surface-sunken px-2 pt-2",
      className,
    )}
  >
    <TabsPrimitive.List className="flex w-max min-w-full items-end gap-1 bg-transparent p-0">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "group relative inline-flex items-center gap-2 whitespace-nowrap px-5 py-3 text-[13px] font-semibold uppercase tracking-wider transition-all duration-300",
              "rounded-t-[22px]",
              "text-muted-foreground hover:text-foreground",
              "data-[state=active]:bg-surface-raised data-[state=active]:text-gold data-[state=active]:font-bold",
              "data-[state=active]:shadow-[0_-2px_12px_rgba(0,0,0,.15)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45",
            )}
          >
            {Icon ? <Icon size={15} className="opacity-90" /> : null}
            <span>{tab.label}</span>
          </TabsPrimitive.Trigger>
        );
      })}
    </TabsPrimitive.List>
  </div>
));
PremiumTabsList.displayName = "PremiumTabsList";

export const PremiumTabsBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden rounded-[24px] border border-gold/15 bg-surface",
      className,
    )}
    {...props}
  />
));
PremiumTabsBody.displayName = "PremiumTabsBody";

export const PremiumTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "p-4 md:p-6 focus-visible:outline-none",
      "data-[state=active]:animate-premium-tab-in",
      className,
    )}
    {...props}
  />
));
PremiumTabsContent.displayName = "PremiumTabsContent";
