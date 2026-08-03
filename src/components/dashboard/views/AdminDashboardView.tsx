import React, { memo } from "react";
import { DashboardShell, DashboardHeader, KPIGrid } from "../DashboardShell";
import { MetricCard } from "../MetricCard";
import { ExecutiveSummary } from "../ExecutiveSummary";
import { InsightsPanel } from "../InsightsPanel";
import { SubscriptionsPremiumCards } from "../SubscriptionsPremiumCards";
import { TenantCharts } from "../TenantCharts";
import { 
  Users, 
  Scissors, 
  Calendar, 
  CircleDollarSign,
  TrendingUp,
  Target,
  Wallet,
  ArrowUpRight,
  TicketPercent,
  UserPlus
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";

interface AdminDashboardViewProps {
  stats: any;
  todayAppointments: any[];
  barbers: any[];
  birthdayCustomers: any[];
  tenantId: string | null;
  navigate: any;
  setIsWalkinOpen: (open: boolean) => void;
  dashboardTab: string;
  setDashboardTab: (tab: string) => void;
}

export const AdminDashboardView = memo(({
  stats,
  todayAppointments,
  barbers,
  birthdayCustomers,
  tenantId,
  navigate,
  setIsWalkinOpen,
  dashboardTab,
  setDashboardTab
}: AdminDashboardViewProps) => {
  return (
    <DashboardShell
      header={
        <DashboardHeader 
          title="Visão Executiva" 
          subtitle="Controle total da sua operação e saúde financeira."
          actions={
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                className="border-gold/30 hover:bg-gold/5 text-gold"
                onClick={() => navigate({ to: "/settings" })}
              >
                Configurações
              </Button>
            </div>
          }
        />
      }
    >
      <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-white/5 p-1 border border-white/10 rounded-2xl w-fit">
            <TabsTrigger value="daily" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6">Hoje</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6">Mensal</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6">Gráficos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="daily" className="space-y-8 mt-0">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-8">
              <ExecutiveSummary 
                appointments={todayAppointments} 
                stats={stats} 
                birthdaysCount={birthdayCustomers.length}
              />
              
              <KPIGrid>
                <MetricCard
                  label="Vendas em serviços"
                  value={`R$ ${stats.daily.totalServicesValue.toFixed(2)}`}
                  hint="Valor bruto realizado"
                  icon={Scissors}
                  tone="blue"
                />
                <MetricCard
                  label="Entrada real (dinheiro)"
                  value={`R$ ${stats.daily.realCashInflow.toFixed(2)}`}
                  hint="Dinheiro novo em caixa"
                  icon={CircleDollarSign}
                  tone="emerald"
                />
                <MetricCard
                  label="Créditos utilizados"
                  value={`R$ ${stats.daily.creditsUsed.toFixed(2)}`}
                  hint="Uso de saldos anteriores"
                  icon={Wallet}
                  tone="purple"
                />
                <MetricCard
                  label="Cashback concedido"
                  value={`R$ ${stats.daily.cashbackEarned.toFixed(2)}`}
                  hint="Hoje"
                  icon={TicketPercent}
                  tone="gold"
                />
              </KPIGrid>
            </div>

            <div className="lg:col-span-4">
              <InsightsPanel
                appointments={todayAppointments}
                stats={stats}
                barbers={barbers}
                birthdaysCount={birthdayCustomers.length}
              />
            </div>
          </div>

          {tenantId && (
            <div className="pt-4">
              <SubscriptionsPremiumCards tenantId={tenantId} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-8 mt-0">
          <KPIGrid>
            <MetricCard
              label="Serviços vendidos (mês)"
              value={`R$ ${stats.monthly.totalServicesValue.toFixed(2)}`}
              hint="Valor total no mês"
              icon={Scissors}
              tone="blue"
            />
            <MetricCard
              label="Entrada real (mês)"
              value={`R$ ${stats.monthly.realCashInflow.toFixed(2)}`}
              hint="Dinheiro novo em caixa"
              icon={CircleDollarSign}
              tone="emerald"
            />
            <MetricCard
              label="Créditos usados (mês)"
              value={`R$ ${stats.monthly.creditsUsed.toFixed(2)}`}
              hint="Abatido via créditos"
              icon={Wallet}
              tone="purple"
            />
            <MetricCard
              label="Ticket médio (mês)"
              value={`R$ ${stats.monthly.appointments > 0 ? (stats.monthly.totalServicesValue / stats.monthly.appointments).toFixed(2) : "0.00"}`}
              hint="Baseado no mês atual"
              icon={Target}
              tone="gold"
            />
          </KPIGrid>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <div className="p-6 glass rounded-[2.5rem] border border-white/5">
            <TenantCharts tenantId={tenantId || ""} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass border-white/5 rounded-3xl">
          <CardHeader>
            <CardTitle className="italic uppercase tracking-tighter text-white">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={() => setIsWalkinOpen(true)}
              className="group relative h-10 gap-2 overflow-hidden rounded-xl border border-gold/60 bg-gradient-to-r from-gold via-[#F0D67B] to-gold px-4 text-xs font-black text-black shadow-xl transition-all hover:brightness-110"
            >
              <UserPlus size={16} />
              <span>Agendamento Presencial</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/customers" })}
              className="h-10 gap-2 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all font-bold"
            >
              <Users size={16} />
              <span>Gestão de Clientes</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/barbers" })}
              className="h-10 gap-2 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all font-bold"
            >
              <Target size={16} />
              <span>Ver Equipe</span>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 glass border-white/5 rounded-3xl">
          <CardHeader>
            <CardTitle className="italic uppercase tracking-tighter text-white">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <TrendingUp size={20} />
              <span className="text-sm uppercase tracking-widest">Operação Online</span>
            </div>
            <p className="text-xs text-gray-400 font-medium">
              A plataforma está monitorando {stats.total.customers} clientes e {stats.total.services} serviços ativos.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/5 rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="italic uppercase tracking-tighter text-white">Equipe Principal</CardTitle>
            <CardDescription className="text-gray-500 font-medium">Profissionais ativos na sua unidade</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-gold hover:bg-gold/5">
            <Link to="/barbers">Ver Todos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {barbers.map((barber) => (
              <div key={barber.id} className="flex items-center gap-3 p-4 border border-white/5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors group">
                <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center overflow-hidden border border-gold/20 group-hover:border-gold/40 transition-colors">
                  {barber.avatar_url ? (
                    <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-gold font-black text-sm">{typeof barber.name === 'string' ? barber.name.substring(0, 2).toUpperCase() : "??"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate italic uppercase tracking-tight">{barber.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-white/5 text-gray-400 group-hover:bg-gold/10 group-hover:text-gold transition-colors">
                      {barber.category}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
});
