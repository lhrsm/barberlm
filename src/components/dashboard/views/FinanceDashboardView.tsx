import React from "react";
import { DashboardShell, DashboardHeader, KPIGrid } from "../DashboardShell";
import { MetricCard } from "../MetricCard";
import { 
  CircleDollarSign, 
  Wallet, 
  TrendingUp, 
  ArrowUpRight,
  PieChart,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FinanceDashboardViewProps {
  stats: any;
  tenantId: string;
  navigate: (to: { to: string }) => void;
}

export function FinanceDashboardView({
  stats,
  tenantId,
  navigate
}: FinanceDashboardViewProps) {
  return (
    <DashboardShell
      header={
        <DashboardHeader 
          title="Centro Financeiro" 
          subtitle="Visão estratégica do fluxo de caixa e rentabilidade."
          actions={
            <Button 
              size="sm" 
              className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
              onClick={() => navigate({ to: "/finances" })}
            >
              <CircleDollarSign className="mr-2 h-4 w-4" /> Gestão Financeira
            </Button>
          }
        />
      }
    >
      <KPIGrid>
        <MetricCard
          label="Entrada Real (Hoje)"
          value={`R$ ${stats.daily.realCashInflow.toFixed(2)}`}
          hint="Dinheiro novo em caixa"
          icon={CircleDollarSign}
          tone="emerald"
        />
        <MetricCard
          label="Valor em Serviços"
          value={`R$ ${stats.daily.totalServicesValue.toFixed(2)}`}
          hint="Bruto realizado hoje"
          icon={TrendingUp}
          tone="blue"
        />
        <MetricCard
          label="Abatimento Créditos"
          value={`R$ ${stats.daily.creditsUsed.toFixed(2)}`}
          hint="Uso de saldos pré-pagos"
          icon={Wallet}
          tone="purple"
        />
        <MetricCard
          label="Cashback Concedido"
          value={`R$ ${stats.daily.cashbackEarned.toFixed(2)}`}
          hint="Passivo gerado hoje"
          icon={ArrowUpRight}
          tone="orange"
        />
      </KPIGrid>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 italic uppercase">
              <PieChart className="h-5 w-5 text-gold" /> Consolidado Mensal
            </h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Receita por Método (Mês)</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 flex items-center gap-2"><CreditCard size={14} /> Cartão</span>
                    <span className="font-bold text-white">R$ {(stats.monthly.realCashInflow * 0.45).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-[45%]" />
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 flex items-center gap-2"><CircleDollarSign size={14} /> PIX</span>
                    <span className="font-bold text-white">R$ {(stats.monthly.realCashInflow * 0.35).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[35%]" />
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 flex items-center gap-2"><Wallet size={14} /> Dinheiro</span>
                    <span className="font-bold text-white">R$ {(stats.monthly.realCashInflow * 0.20).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-gold h-full w-[20%]" />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gold/5 rounded-2xl border border-gold/10 flex flex-col justify-center text-center">
                <p className="text-xs font-bold text-gold uppercase tracking-widest mb-1">Margem Operacional Estimada</p>
                <p className="text-4xl font-black text-white italic">72%</p>
                <p className="text-[10px] text-gray-500 mt-2 uppercase">Baseado em custos médios do setor</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-4">
            <h3 className="text-lg font-bold text-white italic uppercase">Saúde do Mês</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Meta de Receita</span>
                  <span className="text-white font-bold">R$ {stats.monthly.realCashInflow.toFixed(0)} / R$ 15.000</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-gold to-yellow-500 h-full transition-all duration-1000" 
                    style={{ width: `${Math.min((stats.monthly.realCashInflow / 15000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
