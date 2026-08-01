import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, CircleDollarSign, Clock, Users, Scissors, TrendingUp, Edit2, 
  User as UserIcon, LogOut, RefreshCcw, CheckCircle2, Phone, Mail, UserCheck, X,
  AlertCircle, Eye, ChevronLeft, ChevronRight, Filter, Crown, Plus, MessageSquare as MessageSquareText
} from "lucide-react";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchBarberStats } from "@/hooks/use-barber-stats";
import { EditProfileDialog } from "@/components/professional/EditProfileDialog";
import { EditScheduleDialog } from "@/components/professional/EditScheduleDialog";
import { CancelAppointmentDialog } from "@/components/professional/CancelAppointmentDialog";
import { ProfessionalNotifications } from "@/components/professional/ProfessionalNotifications";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";
import { ProfessionalHero } from "@/components/professional/panel/ProfessionalHero";
import { ProfessionalKpiGrid } from "@/components/professional/panel/ProfessionalKpiGrid";
import { ProfessionalTimeline } from "@/components/professional/panel/ProfessionalTimeline";
import { ProfessionalInsights } from "@/components/professional/panel/ProfessionalInsights";
import { ProfessionalEvolution } from "@/components/professional/panel/ProfessionalEvolution";
import { useProfessionalExtras } from "@/components/professional/panel/useProfessionalExtras";
import { buildTodaySummary, buildEvolution, buildInsights, sameDay } from "@/components/professional/panel/metrics";

export const Route = createFileRoute("/$slug/profissional")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "appointments"
    }
  },
  component: ProfessionalDashboard,
  head: () => ({
    meta: [
      { title: "Área do Profissional — Sua agenda do dia" },
      {
        name: "description",
        content:
          "Acompanhe sua agenda, atenda clientes, registre comandas e veja suas comissões em tempo real.",
      },
      { property: "og:title", content: "Área do Profissional" },
      {
        property: "og:description",
        content: "Agenda do dia, comandas e comissões do profissional da barbearia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});


function ProfessionalDashboard() {
  const { session, loading, logout } = useProfessionalAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: '/$slug/profissional' }) as any;
  const [currentTab, setCurrentTab] = useState(search.tab || "appointments");
  const { updateStatus: centralUpdateStatus } = useAppointmentStatus();
  
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barber, setBarber] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [commissionEntries, setCommissionEntries] = useState<any[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<any>(null);
  const [appointmentFilter, setAppointmentFilter] = useState<'today'|'week'|'month'|'completed'|'cancelled'|'pending'>('today');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ——— Camada de leitura premium (somente apresentação, zero regra de negócio) ———
  const { reviews, productSales } = useProfessionalExtras(session?.barber_id, !!session?.barber_id);

  const todaySummary = useMemo(() => buildTodaySummary(appointments), [appointments]);
  const evolution = useMemo(() => buildEvolution(appointments), [appointments]);

  const monthlyGoal = Number(barber?.monthly_goal || 0);
  const productionMonth = Number(commissionSummary?.production_total || stats?.revenueMonth || 0);
  const commissionForecast = Number(commissionSummary?.commission_total || stats?.commissionMonth || 0);

  const productsToday = useMemo(() => {
    const now = new Date();
    const rows = productSales.filter((s) => s.created_at && sameDay(new Date(s.created_at), now));
    return { count: rows.length, total: rows.reduce((s, p) => s + Number(p.total_amount || 0), 0) };
  }, [productSales]);

  const ratingStats = useMemo(() => {
    const list = reviews.map((r) => Number(r.barber_rating || 0)).filter((n) => n > 0);
    return { avg: list.length ? list.reduce((a, b) => a + b, 0) / list.length : null, count: list.length };
  }, [reviews]);

  const { insights, objectives } = useMemo(
    () => buildInsights(todaySummary, evolution, stats, monthlyGoal, productionMonth),
    [todaySummary, evolution, stats, monthlyGoal, productionMonth],
  );



  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchData();
      await queryClient.invalidateQueries();
      toast.success("Painel atualizado com sucesso");
    } catch (e) {
      console.error("[MANUAL_REFRESH_ERROR]", e);
      toast.error("Erro ao atualizar o painel");
    } finally {
      setIsRefreshing(false);
    }
  };

  
  // Sync tab with URL
  useEffect(() => {
    if (search.tab && search.tab !== currentTab) {
      setCurrentTab(search.tab);
    }
  }, [search.tab]);

  // Sync URL with tab
  const handleTabChange = (val: string) => {
    setCurrentTab(val);
    navigate({ search: { tab: val } as any });
  };

  // Dialog States
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  useEffect(() => {
    console.log("[PROFISSIONAL_PAGE_MOUNTED]");
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      console.log("[PROFISSIONAL_NO_SESSION] Redirecting to /auth");
      navigate({ to: "/auth" });
    }
  }, [session, loading, navigate]);


  const fetchData = async () => {
    if (!session?.barber_id) return;
    
    try {
      setError(null);
      console.log("[PROFISSIONAL_FETCH_START]", session.barber_id);
      
      // Stats
      const statsData = await fetchBarberStats(session.barber_id);
      console.log("[PROFISSIONAL_STATS_RESULT]", statsData);
      setStats(statsData);

      // Profile
      const { data: bData, error: bError } = await supabase
        .from("barbers")
        .select("*")
        .eq("id", session.barber_id)
        .single();
      
      if (bError) {
        console.error("[PROFISSIONAL_BARBER_ERROR]", bError);
        throw new Error("Erro ao carregar dados do profissional: " + bError.message);
      }
      console.log("[PROFISSIONAL_BARBER_DATA]", bData);
      setBarber(bData);

      // Tenant profile (business name, permissions, phone)
      if (bData?.user_id) {
        const { data: tData } = await supabase
          .from("profiles")
          .select("business_name, slug, phone, barber_can_cancel, barber_can_reschedule")
          .eq("id", bData.user_id)
          .maybeSingle();
        setTenant(tData);
      }


      // Appointments (via SECURITY DEFINER RPC — barber panel uses anon session,
      // so direct SELECT is blocked by RLS for confirmed/completed appointments)
      const { data: allApps, error: aError } = await supabase
        .rpc("get_barber_appointments", { p_barber_id: session.barber_id });

      if (aError) {
        console.error("[PROFISSIONAL_APPOINTMENTS_ERROR]", aError);
        throw new Error("Erro ao carregar agenda: " + aError.message);
      }

      setAppointments(Array.isArray(allApps) ? allApps : []);

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: entries, error: entriesError }, { data: summary, error: summaryError }] = await Promise.all([
        supabase.rpc("get_barber_commissions", {
          p_tenant_id: bData.tenant_id || bData.user_id,
          p_barber_id: session.barber_id,
          p_start_date: monthStart,
          p_end_date: today,
          p_status: undefined,
        }),
        supabase.rpc("get_barber_commission_summary", {
          p_tenant_id: bData.tenant_id || bData.user_id,
          p_barber_id: session.barber_id,
          p_start_date: monthStart,
          p_end_date: today,
        }),
      ]);
      if (entriesError) throw new Error("Erro ao carregar comissões: " + entriesError.message);
      if (summaryError) throw new Error("Erro ao carregar resumo de comissões: " + summaryError.message);
      setCommissionEntries(Array.isArray(entries) ? entries : []);
      setCommissionSummary(summary || null);
    } catch (e: any) {
      console.error("[PROFISSIONAL_FETCH_ERROR]", e);
      setError(e.message);
    }
  };

  useEffect(() => {
    const bId = session?.barber_id;
    if (!bId) return;
    fetchData();
    const channel = supabase
      .channel(`prof-realtime-${bId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments', filter: `barber_id=eq.${bId}` }, (payload: any) => {
        toast.success("Novo agendamento recebido", {
          description: payload.new?.start_time ? format(new Date(payload.new.start_time), "dd/MM 'às' HH:mm") : undefined,
        });
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `barber_id=eq.${bId}` }, (payload: any) => {
        const oldS = payload.old?.status;
        const newS = payload.new?.status;
        if (oldS !== newS) {
          if (newS === 'cancelled') toast("Agendamento cancelado");
          else if (newS === 'completed') toast.success("Atendimento concluído");
          else if (newS === 'confirmed') toast.success("Agendamento confirmado");
        }
        fetchData();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'appointments', filter: `barber_id=eq.${bId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_commissions', filter: `barber_id=eq.${bId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers', filter: `id=eq.${bId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.barber_id]);

  const handleAction = async (app: any, status: string) => {
    const result = await centralUpdateStatus(app.id, status, {}, 'barber_panel');
    if (result.success) {
      fetchData();
    }
  };

  // WhatsApp / contato com cliente
  const onlyDigits = (v?: string | null) => (v || "").replace(/\D+/g, "");
  const formatDate = (d: string) => format(new Date(d), "dd/MM/yyyy");
  const formatTime = (d: string) => format(new Date(d), "HH:mm");

  const openWhatsapp = (app: any, mode: 'contact' | 'reschedule' | 'cancel' = 'contact') => {
    const phone = onlyDigits(app.customers?.phone);
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    const customerName = app.customers?.name || "Cliente";
    const barberName = barber?.name || session?.name || "seu profissional";
    const shopName = tenant?.business_name || "barbearia";
    const dateStr = formatDate(app.start_time);
    const timeStr = formatTime(app.start_time);

    let msg = `Olá ${customerName}, aqui é ${barberName} da ${shopName}. Estou entrando em contato sobre seu agendamento do dia ${dateStr} às ${timeStr}.`;
    if (mode === 'reschedule') {
      msg += ` Gostaria de remarcar para outro horário, podemos combinar?`;
    } else if (mode === 'cancel') {
      msg += ` Infelizmente preciso solicitar o cancelamento deste atendimento. Podemos conversar?`;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filtros de agendamentos
  const filteredAppointments = (() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return appointments.filter((a) => {
      const d = new Date(a.start_time);
      switch (appointmentFilter) {
        case 'today': return d >= dayStart && d <= dayEnd;
        case 'week': return d >= weekStart;
        case 'month': return d >= monthStart;
        case 'completed': return a.status === 'completed';
        case 'cancelled': return a.status === 'cancelled';
        case 'pending': return a.status === 'scheduled' || a.status === 'confirmed';
        default: return true;
      }
    });
  })();

  const filterLabels: Record<string, string> = {
    today: 'Hoje', week: 'Semana', month: 'Mês',
    completed: 'Concluídos', cancelled: 'Cancelados', pending: 'Pendentes',
  };


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#05070d] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
        <p className="text-[#6B7280] text-sm animate-pulse font-medium">Carregando painel do profissional...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070d] p-4">
        <Card className="max-w-md w-full border-red-900/20 bg-[#0b0f17] shadow-2xl rounded-2xl overflow-hidden text-white">
          <CardHeader className="bg-red-950/20 border-b border-red-900/20">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Erro no Painel</CardTitle>
            </div>
            <CardDescription className="text-red-400/80">
              Ocorreu um problema ao carregar as informações do seu painel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="bg-[#05070d] p-4 rounded-xl border border-red-900/10 text-xs font-mono text-gray-400 break-words leading-relaxed">
              {error}
            </div>
            <Button 
              className="w-full bg-gold hover:bg-[#B8962E] text-black font-bold h-11" 
              onClick={() => window.location.reload()}
            >
              <RefreshCcw className="h-4 w-4 mr-2" /> Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats && !error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#05070d] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
        <p className="text-[#6B7280] text-sm font-medium">Sincronizando dados...</p>
      </div>
    );
  }

  if (!session) return null;

  const dayNames: Record<string, string> = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo"
  };

  const sortedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <AppLayout>
      <div className="space-y-8 pb-12 px-4 md:px-0 bg-[#05070d] min-h-screen text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0b0f17] p-8 rounded-2xl border border-gold/20 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-gold shadow-[0_0_20px_rgba(212,175,55,0.3)]">
              <AvatarImage src={barber?.avatar_url} />
              <AvatarFallback className="bg-gold/10 text-gold text-2xl font-black">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Olá, {session.name} 👋</h1>
              <div className="flex items-center gap-3 mt-3">
                <Badge className={cn(
                  "px-3 py-1 font-black text-[10px] uppercase tracking-wider border-0 shadow-sm",
                  barber?.active ? "bg-green-600 text-white" : "bg-red-600 text-white"
                )}>
                  {barber?.active ? "🟢 Disponível" : "🔴 Indisponível"}
                </Badge>
                <Badge className="px-3 py-1 bg-gold text-black font-black text-[10px] uppercase tracking-wider border-0 shadow-sm">
                  👑 {barber?.category || "Profissional"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProfessionalNotifications barberId={session.barber_id} />
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Atualizar painel"
              className="h-10 w-10 rounded-full bg-transparent border border-gold/40 text-gold hover:bg-gold hover:text-black hover:border-gold hover:shadow-[0_0_18px_rgba(212,175,55,0.45)] transition-all duration-200 disabled:opacity-60"
            >
              <RefreshCcw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowEditProfile(true)}
              title="Meu perfil"
              className="h-10 w-10 rounded-full bg-transparent border border-gold/40 text-gold hover:bg-gold hover:text-black hover:border-gold hover:shadow-[0_0_18px_rgba(212,175,55,0.45)] transition-all duration-200"
            >
              <UserIcon className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              onClick={logout}
              className="h-10 rounded-full px-4 bg-transparent border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.4)] transition-all duration-200 font-bold text-sm"
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Atendimentos Hoje", value: stats.today, icon: Calendar },
            { title: "Atendimentos Semana", value: stats.week, icon: Users },
            { title: "Atendimentos Mês", value: stats.month, icon: Scissors },
            { title: "Faturamento Mês", value: `R$ ${stats.revenueMonth.toFixed(2)}`, icon: CircleDollarSign },
            { title: "Comissão Mês", value: `R$ ${stats.commissionMonth.toFixed(2)}`, icon: Crown },
            { title: "Ticket Médio", value: `R$ ${stats.avgTicket.toFixed(2)}`, icon: TrendingUp },
            { title: "Cancelamentos", value: stats.cancelledMonth, icon: X },
            { title: "Próximo Atendimento", value: stats.nextApp ? format(new Date(stats.nextApp.start_time), "HH:mm") : "---", icon: Clock },
          ].map((stat, i) => (
            <Card key={i} className="bg-[#0b0f17] border-gold/20 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl p-6 transition-all hover:border-gold/50 hover:shadow-[0_8px_24px_rgba(212,175,55,0.1)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{stat.title}</span>
                <stat.icon className="h-6 w-6 text-gold" />
              </div>
              <div className="text-3xl font-black text-white">{stat.value}</div>
            </Card>
          ))}
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-[#0b0f17] p-1.5 gap-2 flex overflow-x-auto h-auto rounded-2xl border border-gold/10 w-fit">
            <TabsTrigger 
              value="appointments" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-gold data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <Calendar className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-gold data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <TrendingUp className="h-4 w-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger 
              value="commission" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-gold data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <CircleDollarSign className="h-4 w-4" /> Comissão
            </TabsTrigger>
            <TabsTrigger 
              value="finances" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-gold data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <CircleDollarSign className="h-4 w-4" /> Financeiro
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-gold data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <UserIcon className="h-4 w-4" /> Perfil
            </TabsTrigger>
          </TabsList>

          
          <TabsContent value="appointments" className="mt-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-gold font-black uppercase text-xs tracking-[0.2em]">
                Minha Agenda — {filterLabels[appointmentFilter]}
              </h2>
              <Button
                size="sm"
                className="bg-gold hover:bg-[#B8962E] text-black rounded-xl font-black px-6 h-11 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                onClick={() => toast.info("Funcionalidade de novo agendamento disponível em breve no painel do profissional.")}
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['today','week','month','pending','completed','cancelled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAppointmentFilter(f)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    appointmentFilter === f
                      ? "bg-gold text-black border-gold shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                      : "bg-[#0b0f17] text-gray-400 border-gold/20 hover:border-gold/50 hover:text-white"
                  )}
                >
                  {filterLabels[f]}
                </button>
              ))}
            </div>

            <div className="grid gap-4">
              {filteredAppointments.length === 0 ? (
                <Card className="border-dashed border-gold/20 py-16 text-center bg-[#0b0f17] rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                  <CardContent className="flex flex-col items-center">
                    <Calendar className="h-16 w-16 text-gold opacity-20 mb-4" />
                    <p className="text-gray-400 font-medium text-lg">Nenhum atendimento neste filtro.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredAppointments.map(app => {
                  const isPending = app.status === 'scheduled' || app.status === 'confirmed';
                  const canCancel = !!tenant?.barber_can_cancel;
                  return (
                    <Card key={app.id} className="overflow-hidden bg-[#0b0f17] border-gold/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl transition-all hover:border-gold/30">
                      <div className="flex flex-col md:flex-row md:items-stretch">
                        <div className="w-full md:w-36 bg-gold/5 p-5 flex md:flex-col items-center justify-center gap-2 md:gap-1 border-b md:border-b-0 md:border-r border-gold/10">
                          <span className="text-2xl md:text-3xl font-black text-white">{format(new Date(app.start_time), "HH:mm")}</span>
                          <span className="text-[10px] uppercase font-black text-gold tracking-wider">
                            {format(new Date(app.start_time), "dd/MM")}
                          </span>
                        </div>

                        <div className="flex-1 p-5 flex items-center gap-4">
                          <Avatar className="h-12 w-12 md:h-14 md:w-14 border-2 border-gold/20 shadow-md shrink-0">
                            <AvatarImage src={app.customers?.avatar_url} />
                            <AvatarFallback className="bg-gold/5 text-gold font-black">{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <h4 className="font-black text-lg md:text-xl truncate text-white">{app.customers?.name || "Cliente"}</h4>
                              <div className="flex flex-col gap-1 items-end shrink-0">
                                <Badge className={cn(
                                  "px-2 py-0.5 font-black text-[9px] uppercase border-0",
                                  app.status === 'completed' ? "bg-green-600" :
                                  app.status === 'cancelled' ? "bg-red-600" :
                                  app.status === 'confirmed' ? "bg-yellow-500 text-black" : "bg-blue-600"
                                )}>
                                  {app.status === 'completed' ? 'CONCLUÍDO' :
                                   app.status === 'cancelled' ? 'CANCELADO' :
                                   app.status === 'confirmed' ? 'CONFIRMADO' : 'AGENDADO'}
                                </Badge>
                                {app.status !== 'cancelled' && app.payment_status === 'paid' && (
                                  <Badge className="bg-green-600/10 text-green-500 border-0 font-black text-[8px] uppercase px-1.5 py-0">PAGO</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-400 flex items-center gap-2 font-medium flex-wrap">
                              <Scissors size={14} className="text-gold" /> {app.services?.name}
                              <span className="text-gray-600">•</span>
                              <span className="font-black text-white">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="p-5 bg-[#05070d]/50 flex flex-col gap-2 border-t md:border-t-0 md:border-l border-gold/10 md:w-[260px]">
                          {isPending ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAction(app, 'completed')}
                                className="bg-gold hover:bg-[#B8962E] text-black rounded-xl font-black h-10 w-full"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openWhatsapp(app, 'contact')}
                                className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-black h-10 w-full"
                              >
                                <MessageSquareText className="h-4 w-4 mr-2" /> Falar no WhatsApp
                              </Button>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openWhatsapp(app, 'reschedule')}
                                  className="bg-transparent text-gold border-gold/30 hover:bg-gold/10 rounded-xl font-black h-10 flex-1 text-[10px] uppercase tracking-wider"
                                >
                                  Reagendar
                                </Button>
                                {canCancel ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setSelectedAppointment(app); setShowCancelDialog(true); }}
                                    className="bg-transparent hover:bg-red-950/20 text-red-500 border-red-900/50 rounded-xl font-black h-10 flex-1 text-[10px] uppercase tracking-wider"
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openWhatsapp(app, 'cancel')}
                                    className="bg-transparent hover:bg-red-950/20 text-red-500 border-red-900/50 rounded-xl font-black h-10 flex-1 text-[10px] uppercase tracking-wider"
                                    title="Cancelamento direto desabilitado pela barbearia"
                                  >
                                    Sol. Cancel.
                                  </Button>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <Badge className={cn(
                                "w-full justify-center py-2 font-black rounded-lg uppercase text-[11px]",
                                app.status === 'completed' ? "bg-green-600/10 text-green-500 border border-green-600/20" : "bg-red-600/10 text-red-500 border border-red-600/20"
                              )}>
                                {app.status === 'completed' ? 'Finalizado' : 'Cancelado'}
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => openWhatsapp(app, 'contact')}
                                className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-black h-10 w-full"
                              >
                                <MessageSquareText className="h-4 w-4 mr-2" /> Falar com Cliente
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>


          <TabsContent value="history" className="mt-8 space-y-6">
            <Card className="bg-[#0b0f17] border-gold/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-gold/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-white">Histórico de Atendimentos</CardTitle>
                  <CardDescription className="text-gray-400 font-medium">Lista completa dos seus serviços prestados.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="bg-gold text-black border-0 rounded-lg h-9 px-4 font-black text-[10px] uppercase">Tudo</Button>
                  <Button variant="outline" size="sm" className="bg-transparent text-white border-gold/30 rounded-lg h-9 px-4 font-black text-[10px] uppercase hover:bg-gold/5 transition-all">Este Mês</Button>
                  <Button variant="outline" size="sm" className="bg-transparent text-white border-gold/30 rounded-lg h-9 px-4 font-black text-[10px] uppercase hover:bg-gold/5 transition-all">
                    <Filter className="h-4 w-4 mr-2 text-gold" /> Filtros
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#05070d] border-b border-gold/10">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Data</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Cliente</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Serviço</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Valor</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold/5 bg-[#0b0f17]">
                      {appointments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic font-medium">Nenhum atendimento registrado.</td>
                        </tr>
                      ) : (
                        appointments.slice(0, 10).map((app, index) => (
                          <tr key={app.id} className="transition-colors hover:bg-gold/5">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-gold" />
                                <span className="text-sm font-bold text-white">{format(new Date(app.start_time), "dd/MM/yyyy")}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 border border-gold/10">
                                  <AvatarImage src={app.customers?.avatar_url} />
                                  <AvatarFallback className="text-[10px] bg-gold/5 text-gold font-bold">{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-bold text-white">{app.customers?.name || "Cliente"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-400 font-medium">{app.services?.name}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-black text-white">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-md uppercase border-0",
                                app.status === 'completed' ? "bg-green-600/20 text-green-500" :
                                app.status === 'cancelled' ? "bg-red-600/20 text-red-500" :
                                "bg-blue-600/20 text-blue-500"
                              )}>
                                {app.status === 'completed' ? 'CONCLUÍDO' : 
                                 app.status === 'cancelled' ? 'CANCELADO' : 'AGENDADO'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {appointments.length > 0 && (
                  <div className="bg-[#05070d]/50 p-4 border-t border-gold/10 flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Mostrando 1-10 de {appointments.length} atendimentos</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gold/20 text-gold bg-transparent hover:bg-gold/10" aria-label="Anterior"><ChevronLeft size={18} /></Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gold/20 text-gold bg-transparent hover:bg-gold/10" aria-label="Próximo"><ChevronRight size={18} /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commission" className="mt-8 space-y-6">
            {(() => {
              const totalMonth = Number(commissionSummary?.commission_total || stats?.commissionMonth || 0);
              const paidMonth = Number(commissionSummary?.commission_paid || stats?.commissionPaid || 0);
              const pendingMonth = Number(commissionSummary?.commission_pending || stats?.commissionPending || 0);
              const productionMonth = Number(commissionSummary?.production_total || stats?.revenueMonth || 0);
              const goal = Number(barber?.monthly_goal || 0);
              const goalPct = goal > 0 ? Math.min(100, (productionMonth / goal) * 100) : 0;

              return (
                <>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[
                      { title: "Comissão do Mês", value: `R$ ${totalMonth.toFixed(2)}`, icon: CircleDollarSign },
                      { title: "Já Recebido", value: `R$ ${paidMonth.toFixed(2)}`, icon: CheckCircle2 },
                      { title: "A Receber", value: `R$ ${pendingMonth.toFixed(2)}`, icon: Clock },
                      { title: "Produção do Mês", value: `R$ ${productionMonth.toFixed(2)}`, icon: TrendingUp },
                    ].map((s, i) => (
                      <Card key={i} className="bg-[#0b0f17] border-gold/20 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{s.title}</span>
                          <s.icon className="h-6 w-6 text-gold" />
                        </div>
                        <div className="text-2xl font-black text-white">{s.value}</div>
                      </Card>
                    ))}
                  </div>

                  <Card className="bg-[#0b0f17] border-gold/10 rounded-2xl">
                    <CardHeader className="border-b border-gold/10 p-6">
                      <CardTitle className="text-xl font-black text-white">Minha Meta Mensal</CardTitle>
                      <CardDescription className="text-gray-400 font-medium">
                        {goal > 0 ? `Meta de produção: R$ ${goal.toFixed(2)}` : "Nenhuma meta definida pelo administrador."}
                      </CardDescription>
                    </CardHeader>
                    {goal > 0 && (
                      <CardContent className="p-6 space-y-3">
                        <div className="flex justify-between text-sm font-bold text-white">
                          <span>R$ {productionMonth.toFixed(2)}</span>
                          <span className="text-gold">{goalPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-3 bg-[#05070d] rounded-full overflow-hidden border border-gold/10">
                          <div className="h-full bg-gold transition-all" style={{ width: `${goalPct}%` }} />
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  <Card className="bg-[#0b0f17] border-gold/10 rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-gold/10 p-6">
                      <CardTitle className="text-xl font-black text-white">Minha Produção (últimos lançamentos)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-[#05070d] border-b border-gold/10">
                            <tr>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Data</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Cliente</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Serviço</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Valor do Serviço</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Comissão</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gold/5">
                            {commissionEntries.length === 0 ? (
                              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">Nenhum lançamento de comissão ainda.</td></tr>
                            ) : commissionEntries.slice(0, 15).map(e => (
                              <tr key={e.id} className="hover:bg-gold/5">
                                <td className="px-6 py-3 text-sm text-white font-bold">{format(new Date(e.appointment_date || e.created_at), "dd/MM/yyyy")}</td>
                                <td className="px-6 py-3 text-sm text-gray-300">{e.customer_name || "Cliente"}</td>
                                <td className="px-6 py-3 text-sm text-gray-300">{e.service_name || "Serviço"}</td>
                                <td className="px-6 py-3 text-sm text-gray-300">R$ {Number(e.service_amount || 0).toFixed(2)}</td>
                                <td className="px-6 py-3 text-sm font-black text-gold">R$ {Number(e.commission_amount).toFixed(2)}</td>
                                <td className="px-6 py-3">
                                  <Badge className={cn(
                                    "text-[9px] font-black px-2 py-0.5 uppercase border-0",
                                    e.status === 'paid' ? "bg-green-600/20 text-green-500" :
                                    e.status === 'cancelled' ? "bg-red-600/20 text-red-500" :
                                    "bg-yellow-600/20 text-yellow-500"
                                  )}>
                                    {e.status === 'paid' ? 'PAGO' : e.status === 'cancelled' ? 'CANCELADO' : 'PENDENTE'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#0b0f17] border-gold/10 rounded-2xl p-6">
                    <CardTitle className="text-xl font-black text-white mb-2">Ciclo de Pagamento</CardTitle>
                    <CardDescription className="text-gray-400 font-medium">
                      As comissões nascem como pendentes e só entram como recebidas após autorização do administrador.
                    </CardDescription>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="finances" className="mt-8 space-y-6">
            {(() => {
              const completedCount = Number(commissionSummary?.completed_appointments || stats?.month || 0);
              const revenue = Number(commissionSummary?.production_total || stats?.revenueMonth || 0);
              const avgTicket = Number(commissionSummary?.average_ticket || stats?.avgTicket || 0);
              const totalCommission = Number(commissionSummary?.commission_total || stats?.commissionMonth || 0);
              const paidCommission = Number(commissionSummary?.commission_paid || stats?.commissionPaid || 0);
              const pendingCommission = Number(commissionSummary?.commission_pending || stats?.commissionPending || 0);

              const cards = [
                { title: 'Atendimentos Concluídos', value: String(completedCount), icon: CheckCircle2 },
                { title: 'Faturamento Gerado', value: `R$ ${revenue.toFixed(2)}`, icon: CircleDollarSign },
                { title: 'Ticket Médio', value: `R$ ${avgTicket.toFixed(2)}`, icon: TrendingUp },
                { title: 'Comissão Gerada', value: `R$ ${totalCommission.toFixed(2)}`, icon: Crown },
                { title: 'Comissão Paga', value: `R$ ${paidCommission.toFixed(2)}`, icon: CheckCircle2 },
                { title: 'Comissão Pendente', value: `R$ ${pendingCommission.toFixed(2)}`, icon: Clock },
                { title: 'Atendimentos no Mês', value: String(completedCount), icon: Calendar },
              ];

              return (
                <>
                  <div className="bg-[#0b0f17] border border-gold/20 rounded-2xl p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold mb-1">Financeiro Pessoal</p>
                    <h2 className="text-2xl font-black text-white">Resumo do Mês</h2>
                    <p className="text-sm text-gray-400 font-medium mt-1">Dados exclusivos do seu desempenho. Não inclui informações da barbearia.</p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {cards.map((c, i) => (
                      <Card key={i} className="bg-[#0b0f17] border-gold/20 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{c.title}</span>
                          <c.icon className="h-5 w-5 text-gold" />
                        </div>
                        <div className="text-2xl font-black text-white">{c.value}</div>
                      </Card>
                    ))}
                  </div>

                  <Card className="bg-[#0b0f17] border-gold/10 rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-gold/10 p-6">
                      <CardTitle className="text-xl font-black text-white">Histórico de Serviços (mês)</CardTitle>
                      <CardDescription className="text-gray-400 font-medium">Últimos atendimentos concluídos por você.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-[#05070d] border-b border-gold/10">
                            <tr>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Data</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Cliente</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Serviço</th>
                              <th className="px-6 py-4 text-left text-[10px] font-black text-gold uppercase tracking-widest">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gold/5">
                            {commissionEntries.length === 0 ? (
                              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">Nenhum atendimento concluído este mês.</td></tr>
                            ) : commissionEntries.slice(0, 20).map(e => (
                              <tr key={e.id} className="hover:bg-gold/5">
                                <td className="px-6 py-3 text-sm text-white font-bold">{format(new Date(e.appointment_date || e.created_at), "dd/MM HH:mm")}</td>
                                <td className="px-6 py-3 text-sm text-gray-300">{e.customer_name || 'Cliente'}</td>
                                <td className="px-6 py-3 text-sm text-gray-300">{e.service_name || 'Serviço'}</td>
                                <td className="px-6 py-3 text-sm font-black text-gold">R$ {Number(e.service_amount || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="profile" className="mt-8">
            <div className="grid gap-6 md:grid-cols-2">

              <Card className="bg-[#0b0f17] border-gold/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-gold/10 p-6">
                  <CardTitle className="text-xl font-black text-white">Perfil Profissional</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowEditProfile(true)}
                    className="bg-transparent hover:bg-gold/10 text-gold border border-gold/30 rounded-xl font-black px-6 h-10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Edit2 className="h-4 w-4 mr-2" /> Editar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-8 pt-8 px-6 pb-8">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-32 w-32 border-4 border-gold shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                        <AvatarImage src={barber?.avatar_url} />
                        <AvatarFallback className="text-4xl font-black bg-gold/10 text-gold">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2 -right-2 bg-green-500 h-6 w-6 rounded-full border-4 border-[#0b0f17]"></div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-white">{barber?.name}</h3>
                      <p className="text-sm text-gold font-black uppercase tracking-[0.2em] mt-2">{barber?.category || "Profissional"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6 pt-6 border-t border-gold/5">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-gold tracking-[0.2em]">Bio / Descrição</p>
                      <p className="text-sm text-gray-300 leading-relaxed font-medium bg-[#05070d] p-5 rounded-2xl border border-gold/5">
                        {barber?.bio || "Sem descrição informada."}
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div className="flex items-center gap-4 text-sm text-white bg-[#05070d] p-4 rounded-xl border border-gold/5 font-bold">
                        <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-gold" />
                        </div>
                        <span>{barber?.phone || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white bg-[#05070d] p-4 rounded-xl border border-gold/5 font-bold">
                        <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-gold" />
                        </div>
                        <span>{barber?.email || "Não informado"}</span>
                      </div>
                    </div>
                    {barber?.specialties && barber.specialties.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <p className="text-[10px] font-black uppercase text-gold tracking-[0.2em]">Especialidades</p>
                        <div className="flex flex-wrap gap-2">
                          {barber.specialties.map((spec: string, i: number) => (
                            <Badge key={i} variant="outline" className="border-gold/20 text-gold bg-gold/5 font-black text-[9px] uppercase py-1.5 px-4 rounded-lg tracking-wider">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0b0f17] border-gold/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-gold/10 p-6">
                  <CardTitle className="text-xl font-black text-white">Horários de Trabalho</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowEditSchedule(true)}
                    className="bg-transparent hover:bg-gold/10 text-gold border border-gold/30 rounded-xl font-black px-6 h-10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Clock className="h-4 w-4 mr-2" /> Ajustar
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {barber?.working_hours ? (
                      sortedDays.map(dayKey => {
                        const config = barber.working_hours[dayKey];
                        if (!config) return null;
                        return (
                          <div key={dayKey} className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-all",
                            config.enabled ? "bg-[#05070d] border-gold/20 shadow-sm" : "bg-[#0b0f17] border-transparent opacity-30"
                          )}>
                            <span className="text-sm font-black text-white uppercase tracking-wider">{dayNames[dayKey]}</span>
                            <div className="flex items-center gap-2 text-[10px] font-black bg-gold text-black px-4 py-1.5 rounded-lg uppercase tracking-widest">
                              {config.enabled ? `${config.start} - ${config.end}` : "Fechado"}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className="h-12 w-12 text-gold opacity-20 mb-4" />
                        <p className="text-gray-500 font-medium">Nenhum horário cadastrado.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditProfileDialog 
        isOpen={showEditProfile} 
        onClose={() => setShowEditProfile(false)} 
        barber={barber} 
        onUpdate={fetchData} 
      />
      <EditScheduleDialog 
        isOpen={showEditSchedule} 
        onClose={() => setShowEditSchedule(false)} 
        barber={barber} 
        onUpdate={fetchData} 
      />
      <CancelAppointmentDialog 
        isOpen={showCancelDialog} 
        onClose={() => setShowCancelDialog(false)} 
        appointment={selectedAppointment} 
        onConfirm={fetchData} 
      />
    </AppLayout>
  );
}

export default ProfessionalDashboard;
