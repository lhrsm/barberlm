import React from "react";
import { DashboardShell, DashboardHeader, KPIGrid } from "../DashboardShell";
import { MetricCard } from "../MetricCard";
import { ExecutiveSummary } from "../ExecutiveSummary";
import { InsightsPanel } from "../InsightsPanel";
import { 
  Users, 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Scissors
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface ManagerDashboardViewProps {
  stats: any;
  todayAppointments: any[];
  barbers: any[];
  birthdaysCount: number;
  tenantId: string;
  navigate: (to: { to: string }) => void;
}

export function ManagerDashboardView({
  stats,
  todayAppointments,
  barbers,
  birthdaysCount,
  tenantId,
  navigate
}: ManagerDashboardViewProps) {
  return (
    <DashboardShell
      header={
        <DashboardHeader 
          title="Gestão Operacional" 
          subtitle="Acompanhamento em tempo real da equipe e produtividade."
          actions={
            <Button 
              size="sm" 
              className="bg-gold text-black hover:bg-gold/90 font-bold"
              onClick={() => navigate({ to: "/calendar" })}
            >
              <Calendar className="mr-2 h-4 w-4" /> Ver Agenda Completa
            </Button>
          }
        />
      }
    >
      <KPIGrid>
        <MetricCard
          label="Ocupação Hoje"
          value={`${todayAppointments.length > 0 ? Math.round((todayAppointments.filter(a => a.status === 'completed' || a.status === 'confirmed').length / todayAppointments.length) * 100) : 0}%`}
          hint="Taxa de horários preenchidos"
          icon={Clock}
          tone="blue"
        />
        <MetricCard
          label="Agendamentos"
          value={stats.daily.appointments}
          hint="Para hoje"
          icon={Calendar}
          tone="emerald"
        />
        <MetricCard
          label="Novos Clientes"
          value={stats.daily.newCustomers}
          hint="Hoje"
          icon={Users}
          tone="indigo"
        />
        <MetricCard
          label="Tickets Médio"
          value={`R$ ${stats.monthly.appointments > 0 ? (stats.monthly.totalServicesValue / stats.monthly.appointments).toFixed(2) : "0.00"}`}
          hint="Mês atual"
          icon={TrendingUp}
          tone="gold"
        />
      </KPIGrid>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <ExecutiveSummary 
            appointments={todayAppointments} 
            stats={stats} 
            barbers={barbers}
          />
          
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 italic uppercase">
              <Scissors className="h-5 w-5 text-gold" /> Performance da Equipe
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {barbers.map((barber) => (
                <div key={barber.id} className="glass p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center font-bold text-gold">
                      {barber.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{barber.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">{barber.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-400">Ativo</p>
                    <p className="text-[10px] text-gray-500 uppercase">{barber.commission_rate}% Comissão</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <InsightsPanel
            appointments={todayAppointments}
            stats={stats}
            barbers={barbers}
            birthdaysCount={birthdaysCount}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
