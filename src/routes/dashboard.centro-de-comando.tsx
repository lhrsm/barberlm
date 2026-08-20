import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, useMemo, memo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, RefreshCw, Settings, Calendar as CalendarIcon, 
  CheckCircle2, Clock, Users, Scissors, CircleDollarSign, 
  Activity, ArrowRight, UserPlus, Zap, AlertTriangle, 
  ChevronLeft, ChevronRight, LayoutDashboard, Wallet, CreditCard
} from "lucide-react";
import { format, startOfDay, endOfDay, isSameDay, addMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { RescheduleWizard } from "@/components/reschedule/RescheduleWizard";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { KPIGrid, DashboardHeader } from "@/components/dashboard/DashboardShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/centro-de-comando")({
  component: CentroDeComando,
});

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CentroDeComando() {
  const { user, profile, role } = useAuth();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isWalkinOpen, setIsWalkinOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();

    const [apptsRes, barbersRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, customers(*), services(*), barbers:barbers!appointments_barber_id_fkey(*)")
        .eq("tenant_id", tenantId)
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .order("start_time", { ascending: true }),
      supabase
        .from("barbers")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
    ]);

    if (apptsRes.data) setAppointments(apptsRes.data);
    if (barbersRes.data) setBarbers(barbersRes.data);

    // Cálculos de Stats
    const completed = apptsRes.data?.filter(a => a.status === 'completed') || [];
    const active = apptsRes.data?.filter(a => a.status !== 'cancelled') || [];
    const scheduled = active.filter(a => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'pending');
    const totalServicesValue = completed.reduce((acc, a) => acc + Number(a.total_price || 0), 0);
    const realCashInflow = completed.reduce((acc, a) => acc + Number(a.final_amount || 0), 0);
    const pendingAmount = active.filter(a => a.payment_status !== 'paid').reduce((acc, a) => acc + Number(a.final_amount || 0), 0);

    setStats({
      total: active.length,
      completed: completed.length,
      inProgress: active.filter(a => a.status === 'in_progress').length,
      waiting: active.filter(a => a.status === 'confirmed' || a.status === 'scheduled' || a.status === 'pending').length,
      billing: realCashInflow,
      pending: pendingAmount,
      servicesValue: totalServicesValue
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    if (!tenantId) return;
    const channel = supabase
      .channel(`operational-center-${tenantId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments', 
        filter: `tenant_id=eq.${tenantId}`
      }, () => {
        setIsRealtimeActive(true);
        fetchData();
        setTimeout(() => setIsRealtimeActive(false), 2000);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsRealtimeActive(true);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, selectedDate]);

  const handlePrevDay = () => setSelectedDate(prev => new Date(prev.setDate(prev.getDate() - 1)));
  const handleNextDay = () => setSelectedDate(prev => new Date(prev.setDate(prev.getDate() + 1)));
  const handleToday = () => setSelectedDate(new Date());

  const operationalAlerts = useMemo(() => {
    const alerts: any[] = [];
    const now = new Date();

    appointments.forEach(a => {
      if (a.status === 'in_progress') {
        const expectedEnd = parseISO(a.end_time);
        if (now > expectedEnd) {
          const delay = Math.round((now.getTime() - expectedEnd.getTime()) / 60000);
          alerts.push({
            id: `delay-${a.id}`,
            type: 'critical',
            text: `ATENDIMENTO ATRASADO: ${a.barbers?.name} está ${delay} min acima do previsto.`,
            appointment: a
          });
        }
      }
      if (a.status === 'completed' && a.payment_status !== 'paid' && a.final_amount > 0) {
        alerts.push({
          id: `payment-${a.id}`,
          type: 'important',
          text: `PAGAMENTO PENDENTE: ${a.customers?.name} possui ${brl(a.final_amount)} em aberto.`,
          appointment: a
        });
      }
    });

    return alerts;
  }, [appointments]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gold" size={48} />
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-white">CENTRO DE COMANDO</h1>
                {isRealtimeActive && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black text-[9px] uppercase tracking-widest animate-pulse">
                    ● Tempo Real Ativo
                  </Badge>
                )}
              </div>
            <p className="text-slate-400 font-medium">Operação da sua barbearia em tempo real.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 p-2 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handlePrevDay}><ChevronLeft size={16} /></Button>
              <Button 
                variant="ghost" 
                className="text-[10px] font-black uppercase tracking-widest h-9 px-4 hover:text-gold"
                onClick={handleToday}
              >
                {isSameDay(selectedDate, new Date()) ? "HOJE" : format(selectedDate, "dd 'DE' MMM", { locale: ptBR }).toUpperCase()}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleNextDay}><ChevronRight size={16} /></Button>
            </div>
            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={fetchData} className="text-zinc-400 hover:text-white"><RefreshCw size={14} className={cn(loading && "animate-spin")} /></Button>
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white"><Settings size={14} /></Button>
            </div>
          </div>
        </header>

        {/* Resumo Operacional (KPIs) */}
        <KPIGrid cols={5}>
          <MetricCard
            label="Atendimentos"
            value={stats.total}
            hint={`${stats.completed} concluídos`}
            icon={CalendarIcon}
            tone="blue"
          />
          <MetricCard
            label="Em Atendimento"
            value={stats.inProgress}
            hint="Neste momento"
            icon={Activity}
            tone="emerald"
          />
          <MetricCard
            label="Aguardando"
            value={stats.waiting}
            hint="Próximos clientes"
            icon={Clock}
            tone="orange"
          />
          <MetricCard
            label="Faturamento"
            value={brl(stats.billing)}
            hint="Realizado hoje"
            icon={CircleDollarSign}
            tone="gold"
          />
          <MetricCard
            label="Pendente"
            value={brl(stats.pending)}
            hint="A receber hoje"
            icon={Wallet}
            tone="purple"
          />
        </KPIGrid>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Timeline da Agenda */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-[#0b0f17]/40 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold border border-gold/20">
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">AGENDA EM TEMPO REAL</h3>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Linha do tempo operacional</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {appointments.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <p className="text-zinc-500 font-medium italic">Sua agenda está livre nesta data.</p>
                    <div className="flex justify-center gap-3">
                      <Button onClick={() => setIsAppointmentOpen(true)} className="bg-gold text-black font-black uppercase tracking-widest text-[10px]">Novo Agendamento</Button>
                    </div>
                  </div>
                ) : (
                  appointments.map((a) => (
                    <div 
                      key={a.id} 
                      onClick={() => {
                        setSelectedAppointmentId(a.id);
                        setDetailsModalOpen(true);
                      }}
                      className={cn(
                        "group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:border-gold/30 hover:scale-[1.005]",
                        a.status === 'completed' ? "bg-emerald-500/5 border-emerald-500/10 opacity-70" : 
                        a.status === 'in_progress' ? "bg-gold/5 border-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.05)]" : 
                        "bg-white/[0.02] border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-[100px]">
                        <div className="text-sm font-black text-white italic">{format(parseISO(a.start_time), "HH:mm")}</div>
                        <div className="h-8 w-px bg-white/10 hidden sm:block" />
                      </div>
                      
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarImage src={a.barbers?.avatar_url} />
                          <AvatarFallback className="bg-zinc-800 text-[10px] font-black">{a.barbers?.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white uppercase tracking-tight truncate italic">{a.customers?.name || "Cliente"}</div>
                          <div className="text-[10px] text-zinc-400 font-medium truncate uppercase tracking-widest">{a.services?.name} • {a.barbers?.name}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                        <Badge 
                          className={cn(
                            "font-black text-[9px] uppercase tracking-widest px-2",
                            a.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            a.status === 'in_progress' ? "bg-gold/10 text-gold border-gold/20" :
                            a.status === 'cancelled' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                            "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          )}
                        >
                          {a.status === 'completed' ? "Concluído" : 
                           a.status === 'in_progress' ? "Em Atendimento" :
                           a.status === 'cancelled' ? "Cancelado" : (a.status === 'confirmed' ? "Confirmado" : "Pendente")}
                        </Badge>
                        <div className="text-xs font-black text-white">{brl(a.total_price)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Lateral Direita: Ações, Alertas e Equipe */}
          <div className="lg:col-span-4 space-y-8">
            {/* Ações Rápidas */}
            <div className="bg-[#0b0f17]/40 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm">
              <h3 className="text-sm font-black uppercase italic tracking-[0.15em] text-white mb-6">Ações Rápidas</h3>
              <div className="grid gap-3">
                <Button 
                  onClick={() => setIsAppointmentOpen(true)}
                  className="bg-gold text-black font-black uppercase tracking-widest text-[10px] h-12 rounded-xl w-full justify-start gap-3"
                >
                  <CalendarIcon size={16} />
                  <span>Novo Agendamento</span>
                </Button>
                <Button 
                  onClick={() => setIsWalkinOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl w-full justify-start gap-3 border-none"
                >
                  <UserPlus size={16} />
                  <span>Walk-in / Presencial</span>
                </Button>
              </div>
            </div>

            {/* Atenção Necessária */}
            <div className="bg-[#0b0f17]/40 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase italic tracking-[0.15em] text-white">Atenção Necessária</h3>
                {operationalAlerts.length > 0 && <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />}
              </div>
              
              <div className="space-y-3">
                {operationalAlerts.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Tudo certo por aqui.</span>
                  </div>
                ) : (
                  operationalAlerts.map(alert => (
                    <div key={alert.id} className={cn(
                       "flex items-start gap-3 p-4 rounded-2xl border transition-all hover:bg-white/[0.02]",
                      alert.type === 'critical' ? "bg-rose-500/5 border-rose-500/10" : "bg-amber-500/5 border-amber-500/10"
                    )}>
                      <AlertTriangle size={16} className={alert.type === 'critical' ? "text-rose-400 mt-0.5" : "text-amber-400 mt-0.5"} />
                      <div className="space-y-1">
                        <p className={cn("text-xs font-bold uppercase tracking-tight", alert.type === 'critical' ? "text-rose-400" : "text-amber-400")}>
                          {alert.text}
                        </p>
                        <Button
                          variant="link"
                          onClick={() => {
                            if (alert.appointment?.id) {
                              setSelectedAppointmentId(alert.appointment.id);
                              setDetailsModalOpen(true);
                            }
                          }}
                          className="p-0 h-auto text-[10px] font-black uppercase text-gold hover:no-underline opacity-80 hover:opacity-100"
                        >
                          Ver Agendamento
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Equipe Agora */}
            <div className="bg-[#0b0f17]/40 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm">
              <h3 className="text-sm font-black uppercase italic tracking-[0.15em] text-white mb-6">Equipe Agora</h3>
              <div className="space-y-4">
                {barbers.map(barber => {
                  const currentAppt = appointments.find(a => a.barber_id === barber.id && a.status === 'in_progress');
                  const status = currentAppt ? "Em Atendimento" : "Livre";
                  
                  return (
                    <div key={barber.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/10 group-hover:border-gold/30 transition-colors">
                          <AvatarImage src={barber.avatar_url} />
                          <AvatarFallback className="bg-zinc-800 text-[10px] font-black">{barber.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-black text-white uppercase tracking-tight italic">{barber.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", currentAppt ? "bg-gold animate-pulse" : "bg-emerald-500")} />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{status}</span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-zinc-700 group-hover:text-gold transition-colors" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AppointmentModal open={isAppointmentOpen} onOpenChange={setIsAppointmentOpen} onSuccess={fetchData} />
      <AppointmentDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        appointmentId={selectedAppointmentId}
        onSuccess={fetchData}
        onReschedule={(appt) => {
          setRescheduleAppt(appt);
          setRescheduleOpen(true);
        }}
      />
      <RescheduleWizard
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        appointment={rescheduleAppt}
        actor="admin"
        actorId={user?.id}
        source="centro_de_comando"
        onSuccess={fetchData}
      />
      <WalkinModal open={isWalkinOpen} onOpenChange={setIsWalkinOpen} onSuccess={fetchData} />
    </>
  );
}
