import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Clock, RefreshCcw, TicketPercent, Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancesTabsListProps {
  role: string | null | undefined;
  financeTab: string;
  setFinanceTab: (v: string) => void;
}

export function FinancesTabsList({ role, financeTab, setFinanceTab }: FinancesTabsListProps) {
  const items = [
    ...(role !== 'barber' ? [{ v: "managerial", icon: BarChart3, label: "Visão Gerencial" }] : []),
    { v: "transactions", icon: FileText, label: "Lançamentos" },
    { v: "pending", icon: Clock, label: "Pendentes" },
    { v: "refunds", icon: RefreshCcw, label: "Estornos" },
    ...(role !== 'barber' ? [
      { v: "coupons", icon: TicketPercent, label: "Cupons" },
      { v: "barbers", icon: Users, label: "Por Barbeiro" },
      { v: "settings", icon: AlertCircle, label: "Configs" },
    ] : []),
  ];

  return (
    <>
      {/* Desktop tabs */}
      <TabsList className={cn("hidden md:grid w-full bg-card border border-border text-foreground", role !== 'barber' ? "grid-cols-7 max-w-[1220px]" : "grid-cols-3 max-w-[600px]")}>
        {items.map(({ v, icon: Icon, label }) => (
          <TabsTrigger key={v} value={v} className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Icon size={16} /> {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Mobile premium tabs (Mercado Pago style) */}
      <div className="md:hidden rounded-[24px] border border-[rgba(255,184,0,0.15)] bg-[#0A1020] overflow-hidden">
        <div className="premium-tabs-scroll overflow-x-auto bg-[#050816] px-2 pt-2">
          <div className="flex w-max min-w-full items-end gap-1">
            {items.map(({ v, icon: Icon, label }) => {
              const active = financeTab === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFinanceTab(v)}
                  className={cn(
                    "group relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all duration-300 rounded-t-[22px] focus-visible:outline-none",
                    active
                      ? "bg-white text-[#111111] font-bold shadow-[0_-2px_12px_rgba(0,0,0,.15)]"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <Icon size={15} className="opacity-90" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
