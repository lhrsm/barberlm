import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, FileDown, RefreshCcw, Calculator } from "lucide-react";
import type { ReportPeriod } from "@/lib/finances-pdf";

interface FinancesHeaderProps {
  role: string | null | undefined;
  globalPeriod: ReportPeriod;
  setGlobalPeriod: (p: ReportPeriod) => void;
  isExportingPdf: boolean;
  onExportPdf: () => void;
  onSyncAll: () => void;
  onRecalculateBalances: () => void;
}

export function FinancesHeader({
  role,
  globalPeriod,
  setGlobalPeriod,
  isExportingPdf,
  onExportPdf,
  onSyncAll,
  onRecalculateBalances,
}: FinancesHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Financeiro</h2>
          <p className="text-muted-foreground text-sm">Controle suas entradas e saídas.</p>
        </div>
        {role !== "barber" && (
          <div className="flex items-center gap-2 bg-[#0A1020] border border-[rgba(255,184,0,0.25)] rounded-[14px] px-3 py-2 min-w-[240px]">
            <Calendar size={16} className="text-primary" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground hidden sm:inline">Período:</span>
            <Select value={globalPeriod} onValueChange={(v) => setGlobalPeriod(v as ReportPeriod)}>
              <SelectTrigger className="border-0 bg-transparent h-8 focus:ring-0 text-white font-medium px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="prev_month">Mês anterior</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {role !== "barber" && (
        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:overflow-x-auto pb-2 md:scrollbar-hide">
          <Button
            variant="outline"
            disabled={isExportingPdf}
            className="gap-2 whitespace-nowrap w-full md:w-auto h-11 px-5 rounded-[14px] font-semibold bg-white text-[#B8860B] border border-[#D4AF37]/60 shadow-sm transition-all duration-200 hover:bg-[#FFF4D6] hover:text-black hover:border-[#D4AF37] hover:shadow-[0_10px_28px_-12px_rgba(212,175,55,0.55)] hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onExportPdf}
          >
            <FileDown size={18} /> {isExportingPdf ? "Gerando..." : "Exportar PDF"}
          </Button>
          <Button
            variant="outline"
            className="gap-2 whitespace-nowrap w-full md:w-auto h-11 px-5 rounded-[14px] font-semibold bg-white text-[#B8860B] border border-[#D4AF37]/60 shadow-sm transition-all duration-200 hover:bg-[#FFF4D6] hover:text-black hover:border-[#D4AF37] hover:shadow-[0_10px_28px_-12px_rgba(212,175,55,0.55)] hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-100"
            onClick={onSyncAll}
          >
            <RefreshCcw size={18} /> Sincronizar Tudo
          </Button>
          <Button
            variant="outline"
            className="gap-2 whitespace-nowrap w-full md:w-auto h-11 px-5 rounded-[14px] font-semibold bg-white text-[#B8860B] border border-[#D4AF37]/60 shadow-sm transition-all duration-200 hover:bg-[#FFF4D6] hover:text-black hover:border-[#D4AF37] hover:shadow-[0_10px_28px_-12px_rgba(212,175,55,0.55)] hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-100"
            onClick={onRecalculateBalances}
          >
            <Calculator size={18} /> Recalcular Saldos
          </Button>
        </div>
      )}
    </div>
  );
}
