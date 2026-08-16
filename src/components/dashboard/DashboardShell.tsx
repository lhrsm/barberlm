import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type DashboardShellProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
};

export function DashboardShell({ children, header, className }: DashboardShellProps) {
  return (
    <div className={cn("space-y-8 animate-in fade-in duration-500", className)}>
      {header && (
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {header}
        </header>
      )}
      <main className="space-y-8">
        {children}
      </main>
    </div>
  );
}

export function DashboardHeader({ 
  title, 
  subtitle, 
  actions 
}: { 
  title: string; 
  subtitle?: string; 
  actions?: React.ReactNode 
}) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between w-full">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white italic uppercase">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-[13px] text-gray-500 font-medium max-w-lg mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function KPIGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={cn(
      "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      cols === 3 && "lg:grid-cols-3",
      cols === 2 && "lg:grid-cols-2"
    )}>
      {children}
    </div>
  );
}
