import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, CircleDollarSign, Clock, Users, Scissors, TrendingUp, Edit2, 
  User as UserIcon, LogOut, RefreshCcw, CheckCircle2, Phone, Mail, UserCheck, X,
  AlertCircle, Eye, ChevronLeft, ChevronRight, Filter, Crown, Plus
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

export const Route = createFileRoute("/$slug/profissional")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "appointments"
    }
  },
  component: ProfessionalDashboard,
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
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
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

      // Appointments
      const { data: allApps, error: aError } = await supabase
        .from("appointments")
        .select("*, customers(name, phone, avatar_url), services(name)")
        .eq("barber_id", session.barber_id);
      
      if (aError) {
        console.error("[PROFISSIONAL_APPOINTMENTS_ERROR]", aError);
        throw new Error("Erro ao carregar agenda: " + aError.message);
      }
      
      if (allApps) {
        setAppointments(allApps.sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
      }
    } catch (e: any) {
      console.error("[PROFISSIONAL_FETCH_ERROR]", e);
      setError(e.message);
    }
  };

  useEffect(() => {
    const bId = session?.barber_id;
    if (bId) {
      fetchData();
      const channel = supabase
        .channel(`prof-realtime-${bId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `barber_id=eq.${bId}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `barber_id=eq.${bId}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers', filter: `id=eq.${bId}` }, fetchData)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [session?.barber_id]);

  const handleAction = async (app: any, status: string) => {
    const result = await centralUpdateStatus(app.id, status, {}, 'barber_panel');
    if (result.success) {
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
        <p className="text-[#6B7280] text-sm animate-pulse font-medium">Carregando painel do profissional...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <Card className="max-w-md w-full border-red-200 bg-white shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-red-50/50 border-b border-red-100">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Erro no Painel</CardTitle>
            </div>
            <CardDescription className="text-red-500/80">
              Ocorreu um problema ao carregar as informações do seu painel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs font-mono text-gray-600 break-words leading-relaxed">
              {error}
            </div>
            <Button 
              className="w-full bg-[#D4AF37] hover:bg-[#B8962E] text-black font-bold h-11" 
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0b0f17] p-8 rounded-2xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.3)]">
              <AvatarImage src={barber?.avatar_url} />
              <AvatarFallback className="bg-[#D4AF37]/10 text-[#D4AF37] text-2xl font-black">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
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
                <Badge className="px-3 py-1 bg-[#D4AF37] text-black font-black text-[10px] uppercase tracking-wider border-0 shadow-sm">
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
              onClick={fetchData} 
              className="h-12 w-12 rounded-2xl border-[#D4AF37]/30 bg-[#05070d] text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]"
            >
              <RefreshCcw className="h-6 w-6" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={logout} 
              className="text-red-400 hover:bg-red-950/30 rounded-2xl h-12 px-6 font-bold"
            >
              <LogOut className="h-5 w-5 mr-2" /> Sair
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
            <Card key={i} className="bg-[#0b0f17] border-[#D4AF37]/20 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl p-6 transition-all hover:border-[#D4AF37]/50 hover:shadow-[0_8px_24px_rgba(212,175,55,0.1)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{stat.title}</span>
                <stat.icon className="h-6 w-6 text-[#D4AF37]" />
              </div>
              <div className="text-3xl font-black text-white">{stat.value}</div>
            </Card>
          ))}
        </div>

        <Tabs value={currentTab} onValueChange={(val) => navigate({ search: { tab: val } })} className="w-full">
          <TabsList className="bg-[#0b0f17] p-1.5 gap-2 flex overflow-x-auto h-auto rounded-2xl border border-[#D4AF37]/10 w-fit">
            <TabsTrigger 
              value="appointments" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <Calendar className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <TrendingUp className="h-4 w-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="gap-2 px-8 py-3 rounded-xl transition-all data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-gray-400 font-black uppercase text-xs tracking-wider"
            >
              <UserIcon className="h-4 w-4" /> Perfil
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="appointments" className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[#D4AF37] font-black uppercase text-xs tracking-[0.2em]">Agendamentos de Hoje</h2>
              <Button 
                size="sm"
                className="bg-[#D4AF37] hover:bg-[#B8962E] text-black rounded-xl font-black px-6 h-11 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                onClick={() => toast.info("Funcionalidade de novo agendamento disponível em breve no painel do profissional.")}
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
              </Button>
            </div>
            
            <div className="grid gap-4">
              {appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).length === 0 ? (
                <Card className="border-dashed border-[#D4AF37]/20 py-16 text-center bg-[#0b0f17] rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                  <CardContent className="flex flex-col items-center">
                    <Calendar className="h-16 w-16 text-[#D4AF37] opacity-20 mb-4" />
                    <p className="text-gray-400 font-medium text-lg">Nenhum atendimento para hoje.</p>
                  </CardContent>
                </Card>
              ) : (
                appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).map(app => (
                  <Card key={app.id} className="overflow-hidden bg-[#0b0f17] border-[#D4AF37]/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl transition-all hover:border-[#D4AF37]/30">
                    <div className="flex flex-col md:flex-row md:items-center">
                      <div className="w-full md:w-32 bg-[#D4AF37]/5 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#D4AF37]/10">
                        <span className="text-3xl font-black text-white">{format(new Date(app.start_time), "HH:mm")}</span>
                        <span className="text-[10px] uppercase font-black text-[#D4AF37] tracking-wider mt-1">Hoje</span>
                      </div>
                      
                      <div className="flex-1 p-6 flex items-center gap-6">
                        <Avatar className="h-14 w-14 border-2 border-[#D4AF37]/20 shadow-md">
                          <AvatarImage src={app.customers?.avatar_url} />
                          <AvatarFallback className="bg-[#D4AF37]/5 text-[#D4AF37] font-black">{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-black text-xl truncate text-white">{app.customers?.name || "Cliente"}</h4>
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
                          </div>
                          <p className="text-sm text-gray-400 flex items-center gap-2 font-medium">
                            <Scissors size={14} className="text-[#D4AF37]" /> {app.services?.name}
                            <span className="text-gray-600">•</span>
                            <span className="font-black text-white">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="p-6 bg-[#05070d]/50 flex items-center gap-3 border-t md:border-t-0 md:border-l border-[#D4AF37]/10">
                        {app.status === 'scheduled' || app.status === 'confirmed' ? (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleAction(app, 'completed')} 
                              className="bg-[#D4AF37] hover:bg-[#B8962E] text-black rounded-xl font-black px-6 h-11 transition-all hover:scale-[1.02] flex-1"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => { setSelectedAppointment(app); setShowCancelDialog(true); }} 
                              className="bg-transparent hover:bg-red-950/20 text-red-500 border-red-900/50 rounded-xl font-black px-6 h-11 flex-1"
                            >
                              <X className="h-4 w-4 mr-2" /> Cancelar
                            </Button>
                            <Button 
                              size="sm"
                              className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-[#D4AF37]/20 rounded-xl h-11 w-11 p-0 transition-all hover:scale-[1.05]"
                              onClick={() => toast.info(`Detalhes de ${app.customers?.name}`)}
                            >
                              <Eye className="h-4 w-4 text-[#D4AF37]" />
                            </Button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1 w-full min-w-[140px]">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Status Final</span>
                            <Badge className={cn(
                              "w-full justify-center py-2 font-black rounded-lg uppercase text-[11px]",
                              app.status === 'completed' ? "bg-green-600/10 text-green-500 border border-green-600/20" : "bg-red-600/10 text-red-500 border border-red-600/20"
                            )}>
                              {app.status === 'completed' ? 'Finalizado' : 'Cancelado'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-8 space-y-6">
            <Card className="bg-[#0b0f17] border-[#D4AF37]/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-[#D4AF37]/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-white">Histórico de Atendimentos</CardTitle>
                  <CardDescription className="text-gray-400 font-medium">Lista completa dos seus serviços prestados.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="bg-[#D4AF37] text-black border-0 rounded-lg h-9 px-4 font-black text-[10px] uppercase">Tudo</Button>
                  <Button variant="outline" size="sm" className="bg-transparent text-white border-[#D4AF37]/30 rounded-lg h-9 px-4 font-black text-[10px] uppercase hover:bg-[#D4AF37]/5 transition-all">Este Mês</Button>
                  <Button variant="outline" size="sm" className="bg-transparent text-white border-[#D4AF37]/30 rounded-lg h-9 px-4 font-black text-[10px] uppercase hover:bg-[#D4AF37]/5 transition-all">
                    <Filter className="h-4 w-4 mr-2 text-[#D4AF37]" /> Filtros
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#05070d] border-b border-[#D4AF37]/10">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Data</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Cliente</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Serviço</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Valor</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D4AF37]/5 bg-[#0b0f17]">
                      {appointments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic font-medium">Nenhum atendimento registrado.</td>
                        </tr>
                      ) : (
                        appointments.slice(0, 10).map((app, index) => (
                          <tr key={app.id} className="transition-colors hover:bg-[#D4AF37]/5">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                                <span className="text-sm font-bold text-white">{format(new Date(app.start_time), "dd/MM/yyyy")}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 border border-[#D4AF37]/10">
                                  <AvatarImage src={app.customers?.avatar_url} />
                                  <AvatarFallback className="text-[10px] bg-[#D4AF37]/5 text-[#D4AF37] font-bold">{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
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
                  <div className="bg-[#05070d]/50 p-4 border-t border-[#D4AF37]/10 flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Mostrando 1-10 de {appointments.length} atendimentos</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-[#D4AF37]/20 text-[#D4AF37] bg-transparent hover:bg-[#D4AF37]/10"><ChevronLeft size={18} /></Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-[#D4AF37]/20 text-[#D4AF37] bg-transparent hover:bg-[#D4AF37]/10"><ChevronRight size={18} /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-[#0b0f17] border-[#D4AF37]/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-[#D4AF37]/10 p-6">
                  <CardTitle className="text-xl font-black text-white">Perfil Profissional</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowEditProfile(true)}
                    className="bg-transparent hover:bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-xl font-black px-6 h-10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Edit2 className="h-4 w-4 mr-2" /> Editar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-8 pt-8 px-6 pb-8">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-32 w-32 border-4 border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                        <AvatarImage src={barber?.avatar_url} />
                        <AvatarFallback className="text-4xl font-black bg-[#D4AF37]/10 text-[#D4AF37]">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2 -right-2 bg-green-500 h-6 w-6 rounded-full border-4 border-[#0b0f17]"></div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-white">{barber?.name}</h3>
                      <p className="text-sm text-[#D4AF37] font-black uppercase tracking-[0.2em] mt-2">{barber?.category || "Profissional"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6 pt-6 border-t border-[#D4AF37]/5">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-[#D4AF37] tracking-[0.2em]">Bio / Descrição</p>
                      <p className="text-sm text-gray-300 leading-relaxed font-medium bg-[#05070d] p-5 rounded-2xl border border-[#D4AF37]/5">
                        {barber?.bio || "Sem descrição informada."}
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div className="flex items-center gap-4 text-sm text-white bg-[#05070d] p-4 rounded-xl border border-[#D4AF37]/5 font-bold">
                        <div className="h-10 w-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-[#D4AF37]" />
                        </div>
                        <span>{barber?.phone || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white bg-[#05070d] p-4 rounded-xl border border-[#D4AF37]/5 font-bold">
                        <div className="h-10 w-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-[#D4AF37]" />
                        </div>
                        <span>{barber?.email || "Não informado"}</span>
                      </div>
                    </div>
                    {barber?.specialties && barber.specialties.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <p className="text-[10px] font-black uppercase text-[#D4AF37] tracking-[0.2em]">Especialidades</p>
                        <div className="flex flex-wrap gap-2">
                          {barber.specialties.map((spec: string, i: number) => (
                            <Badge key={i} variant="outline" className="border-[#D4AF37]/20 text-[#D4AF37] bg-[#D4AF37]/5 font-black text-[9px] uppercase py-1.5 px-4 rounded-lg tracking-wider">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0b0f17] border-[#D4AF37]/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-[#D4AF37]/10 p-6">
                  <CardTitle className="text-xl font-black text-white">Horários de Trabalho</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowEditSchedule(true)}
                    className="bg-transparent hover:bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-xl font-black px-6 h-10 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
                            config.enabled ? "bg-[#05070d] border-[#D4AF37]/20 shadow-sm" : "bg-[#0b0f17] border-transparent opacity-30"
                          )}>
                            <span className="text-sm font-black text-white uppercase tracking-wider">{dayNames[dayKey]}</span>
                            <div className="flex items-center gap-2 text-[10px] font-black bg-[#D4AF37] text-black px-4 py-1.5 rounded-lg uppercase tracking-widest">
                              {config.enabled ? `${config.start} - ${config.end}` : "Fechado"}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className="h-12 w-12 text-[#D4AF37] opacity-20 mb-4" />
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
