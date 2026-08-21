import * as React from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Scissors,
  ArrowRight,
  Sparkles,
  RefreshCcw,
  ShieldCheck,
  Zap,
  Info,
  CalendarClock,
  History,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlanDetailsModal } from "@/components/portal/PlanDetailsModal";
import { ChangePlanModal } from "@/components/portal/ChangePlanModal";
import { getSubscriptionUsage } from "@/hooks/use-subscription-usage";

interface SubscriberDashboardProps {
  client: any;
  shop: any;
  customerData: any;
  mySubscription: any;
  subscriptionPlans: any[];
  subPlanServices: any[];
  subUsageLogs: any[];
  appointments: any[];
  onNewAppointment: () => void;
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
}

export function SubscriberDashboard({
  client,
  shop,
  customerData,
  mySubscription,
  subscriptionPlans,
  subPlanServices,
  subUsageLogs,
  appointments,
  onNewAppointment,
  onNavigate,
  onRefresh,
}: SubscriberDashboardProps) {
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
  const [changePlanModalOpen, setChangePlanModalOpen] = React.useState(false);

  const plan = mySubscription?.plan || {};
  const usage = getSubscriptionUsage(mySubscription, subPlanServices, subUsageLogs);

  const totalAllowed = usage.total_uses_allowed || (plan?.max_uses_per_month ?? 8);
  const totalConsumed = usage.total_uses_consumed ?? 0;
  const totalAvailable = usage.has_limits ? Math.max(0, totalAllowed - totalConsumed) : "Ilimitado";
  const percentUsed = usage.has_limits && totalAllowed > 0
    ? Math.min(100, Math.round((totalConsumed / totalAllowed) * 100))
    : 0;

  // Datas do ciclo e renovação
  const renewalDate = usage.renewal_date ? new Date(usage.renewal_date) : null;
  const cycleStart = mySubscription?.current_period_start ? new Date(mySubscription.current_period_start) : new Date();
  const cycleEnd = mySubscription?.current_period_end ? new Date(mySubscription.current_period_end) : renewalDate || new Date();
  const daysUntilRenewal = renewalDate ? Math.max(0, differenceInDays(renewalDate, new Date())) : null;

  // Preço mensal
  const monthlyPrice = Number(plan?.monthly_price ?? plan?.price ?? 0);

  // Lista de serviços incluídos reais
  const includedServices = subPlanServices?.length > 0
    ? subPlanServices.map((ps) => ps.service?.name || ps.name).filter(Boolean)
    : ["Corte Tesoura", "Corte Máquina", "Barba", "Combo Cabelo + Barba"];

  // Logs de uso filtrados
  const recentLogs = (subUsageLogs || []).slice(0, 5);

  return (
    <div className="space-y-6 text-left">
      {/* 1. HERO DO ASSINANTE */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gold/15 text-gold border border-gold/30 flex items-center justify-center shadow-md">
                <Crown size={18} />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                Clube Barbex
              </h2>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5">
                Plano Ativo
              </Badge>
            </div>

            <p className="text-sm md:text-base text-zinc-300 font-medium leading-relaxed">
              Você está aproveitando os benefícios do seu plano.
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-zinc-400">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Plano</span>
                <span className="font-extrabold text-white text-sm">{plan?.name || "Plano Barber Semanal"}</span>
              </div>
              {renewalDate && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Próximo Vencimento</span>
                  <span className="font-bold text-gold text-sm">
                    {format(renewalDate, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Ciclo Atual</span>
                <span className="font-medium text-zinc-300 text-sm">
                  {format(cycleStart, "dd/MM", { locale: ptBR })} → {format(cycleEnd, "dd/MM", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          {/* Botão de Agendamento com Destaque */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <Button
              onClick={onNewAppointment}
              className="h-12 px-6 rounded-2xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all"
            >
              <Scissors size={15} className="mr-2" /> Agendar serviço incluído
            </Button>
            <Button
              variant="outline"
              onClick={() => setChangePlanModalOpen(true)}
              className="h-11 px-5 rounded-2xl border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold uppercase text-[11px] tracking-wider transition-all"
            >
              Mudar de plano
            </Button>
          </div>
        </div>
      </div>

      {/* 2. GRID PRINCIPAL: FRANQUIA + PLANO ATUAL + PRÓXIMO VENCIMENTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD DE FRANQUIA */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-gold" />
              <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">
                Sua franquia neste ciclo
              </span>
            </div>
            <span className="text-xs font-black text-gold">
              {percentUsed}% utilizado
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-white">{totalConsumed}</span>
                <span className="text-xs font-bold text-zinc-400"> de {totalAllowed} utilizados</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-emerald-400">{totalAvailable}</span>
                <span className="text-xs text-emerald-400/80 block">disponíveis</span>
              </div>
            </div>

            <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-gold via-amber-400 to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug">
            Serviços incluídos são debitados automaticamente ao confirmar o agendamento.
          </p>
        </div>

        {/* CARD DO PLANO ATUAL */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-gold" />
              <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">
                Plano Atual
              </span>
            </div>
            <Badge variant="outline" className="text-[9px] border-gold/30 text-gold font-black uppercase">
              Mensal
            </Badge>
          </div>

          <div className="space-y-1">
            <h4 className="text-lg font-black text-white">{plan?.name || "Plano Barber Semanal"}</h4>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-gold">
                R$ {monthlyPrice.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-zinc-400 font-medium">/mês</span>
            </div>
            <p className="text-xs text-zinc-400">
              Franquia de <strong>{totalAllowed} serviços</strong> por mês
            </p>
          </div>

          <Button
            variant="ghost"
            onClick={() => setDetailsModalOpen(true)}
            className="w-full h-9 rounded-xl border border-white/10 text-xs font-bold text-white hover:bg-white/5 hover:text-gold uppercase tracking-wider"
          >
            Detalhes do plano
          </Button>
        </div>

        {/* CARD DE PRÓXIMO VENCIMENTO */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-gold" />
              <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">
                Próximo Vencimento
              </span>
            </div>
            {daysUntilRenewal !== null && (
              <Badge className="bg-white/10 text-white text-[10px] font-bold">
                {daysUntilRenewal === 0 ? "Vence hoje" : `Em ${daysUntilRenewal} dias`}
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-2xl font-black text-white">
              {renewalDate ? format(renewalDate, "dd 'de' MMMM", { locale: ptBR }) : "Não informado"}
            </span>
            <div className="flex items-center gap-1.5 pt-1">
              <Calendar size={13} className="text-zinc-400" />
              <span className="text-xs text-zinc-400 font-medium">
                {renewalDate ? `Vencimento do ciclo em ${format(renewalDate, "dd/MM/yyyy", { locale: ptBR })}` : "Vencimento a confirmar"}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <span>Ciclo:</span>
            <span className="font-bold text-zinc-300">
              {format(cycleStart, "dd/MM")} a {format(cycleEnd, "dd/MM")}
            </span>
          </div>
        </div>
      </div>

      {/* 3. SERVIÇOS INCLUÍDOS NO PLANO */}
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={18} className="text-gold" /> Serviços incluídos no seu plano
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Estes serviços são 100% cobertos pela sua franquia mensal do Clube Barbex.
            </p>
          </div>
          <Badge className="bg-gold/10 text-gold border-gold/30 font-black text-[10px] uppercase tracking-widest px-3 py-1 self-start sm:self-auto">
            R$ 0,00 por atendimento
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {includedServices.map((svcName: string, idx: number) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-gold/30 transition-all"
            >
              <div className="h-8 w-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <span className="text-xs font-bold text-white leading-snug">
                {svcName}
              </span>
            </div>
          ))}
        </div>

        {/* 4. BLOCO DISCRETO: SERVIÇOS FORA DO PLANO (AVULSOS) */}
        <div className="mt-4 p-4 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-start gap-3">
          <Info size={16} className="text-zinc-400 mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-400 leading-relaxed">
            <strong className="text-zinc-200 font-bold">Serviços fora do plano:</strong> Você também pode agendar serviços avulsos (como Sobrancelha ou tratamentos especiais) normalmente. Eles não descontam da sua franquia e são cobrados pelo valor de tabela avulso.
          </div>
        </div>
      </div>

      {/* 5. HISTÓRICO DE USO DO CLUBE */}
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-gold" />
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Uso do Clube
            </h3>
          </div>
          <span className="text-xs text-zinc-400">
            {recentLogs.length} utilizações registradas
          </span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs">
            Nenhuma utilização registrada neste ciclo ainda.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentLogs.map((log: any, idx: number) => {
              const isCancelled = log.status === "cancelled";
              const isConsumed = log.status === "consumed" || !log.status;
              const dateStr = log.used_at || log.created_at;

              return (
                <div key={log.id || idx} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                      isCancelled ? "bg-red-500/10 text-red-400" : "bg-gold/10 text-gold"
                    )}>
                      <Scissors size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {log.service?.name || log.service_name || "Serviço do Clube"}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {dateStr ? format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isCancelled ? (
                      <Badge variant="destructive" className="text-[9px] uppercase font-bold px-2 py-0.5">
                        Cancelado (Restituído)
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] uppercase font-black px-2 py-0.5">
                        Consumido (Franquia)
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. AÇÕES RÁPIDAS DO ASSINANTE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={onNewAppointment}
          className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
        >
          <Scissors size={18} className="text-gold mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black text-white uppercase">Novo Agendamento</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Usar franquia do clube</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("appointments")}
          className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
        >
          <Calendar size={18} className="text-gold mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black text-white uppercase">Meus Agendamentos</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Ver status e horários</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("finances")}
          className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
        >
          <Sparkles size={18} className="text-gold mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black text-white uppercase">Créditos & Cashback</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Extrato e economia</p>
        </button>

        <button
          type="button"
          onClick={() => setChangePlanModalOpen(true)}
          className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
        >
          <Crown size={18} className="text-gold mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black text-white uppercase">Mudar de Plano</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Ver opções de planos</p>
        </button>
      </div>

      {/* MODALS */}
      {detailsModalOpen && (
        <PlanDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          subscription={mySubscription}
          planServices={subPlanServices}
          usage={usage}
          onChangePlan={() => {
            setDetailsModalOpen(false);
            setChangePlanModalOpen(true);
          }}
        />
      )}

      {changePlanModalOpen && (
        <ChangePlanModal
          open={changePlanModalOpen}
          onOpenChange={setChangePlanModalOpen}
          tenantId={shop?.id}
          subscriptionId={mySubscription?.id}
          currentPlanId={mySubscription?.plan_id}
          onChanged={() => {
            setChangePlanModalOpen(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
