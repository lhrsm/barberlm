import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  AlertCircle, Eye, ChevronLeft, ChevronRight, Filter
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
  component: ProfessionalDashboard,
});

function ProfessionalDashboard() {
  const { session, loading, logout } = useProfessionalAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { updateStatus: centralUpdateStatus } = useAppointmentStatus();
  
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barber, setBarber] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
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
      <div className="space-y-8 pb-12 px-4 md:px-0 bg-[#0F1115] min-h-screen">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[12px] border border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-[#D4AF37]/20 shadow-sm">
              <AvatarImage src={barber?.avatar_url} />
              <AvatarFallback className="bg-[#D4AF37]/10 text-[#D4AF37]">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">Olá, {session.name} 👋</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn(
                  "border-[#D4AF37]/30",
                  barber?.active ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                )}>
                  {barber?.active ? "Disponível" : "Indisponível"}
                </Badge>
                <span className="text-xs text-[#6B7280]">{barber?.category || "Profissional"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProfessionalNotifications barberId={session.barber_id} />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={fetchData} 
              className="h-10 w-10 rounded-full border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <RefreshCcw className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout} 
              className="text-red-500 hover:bg-red-50 rounded-[10px]"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px] transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-[#111827]">Hoje</CardTitle>
              <Users className="h-4 w-4 text-[#D4AF37]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]">{stats.today}</div>
              <p className="text-xs text-[#6B7280] mt-1 font-medium">{stats.week} na semana</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px] transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-[#111827]">Faturamento Mês</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-[#D4AF37]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]">R$ {stats.revenueMonth.toFixed(2)}</div>
              <p className="text-xs text-[#6B7280] mt-1 font-medium">Ticket: R$ {stats.avgTicket.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px] transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-[#111827]">Cancelamentos</CardTitle>
              <X className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]">{stats.cancelledMonth}</div>
              <p className="text-xs text-[#6B7280] mt-1 font-medium">No mês atual</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px] transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-[#111827]">Próximo</CardTitle>
              <Clock className="h-4 w-4 text-[#D4AF37]" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate text-[#111827]">
                {stats.nextApp ? format(new Date(stats.nextApp.start_time), "HH:mm") : "---"}
              </div>
              <p className="text-xs text-[#6B7280] mt-1 truncate font-medium">
                {stats.nextApp ? `Com ${stats.nextApp.customers?.name || 'Cliente'}` : "Sem agendamentos"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="bg-transparent p-0 gap-3 mb-8 flex overflow-x-auto h-auto">
            <TabsTrigger 
              value="appointments" 
              className="gap-2 flex-1 data-[state=active]:bg-[#111111] data-[state=active]:text-[#D4AF37] data-[state=active]:border-[#D4AF37] data-[state=active]:shadow-[0_4px_16px_rgba(212,175,55,0.2)] bg-white text-[#111827] border border-[#D4AF37] rounded-[10px] py-3.5 transition-all duration-250 ease-in-out hover:bg-[#F9F4E6] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(212,175,55,0.15)] data-[state=active]:hover:bg-[#111111] data-[state=active]:hover:shadow-[0_6px_20px_rgba(212,175,55,0.25)] font-bold"
            >
              <Calendar className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="gap-2 flex-1 data-[state=active]:bg-[#111111] data-[state=active]:text-[#D4AF37] data-[state=active]:border-[#D4AF37] data-[state=active]:shadow-[0_4px_16px_rgba(212,175,55,0.2)] bg-white text-[#111827] border border-[#D4AF37] rounded-[10px] py-3.5 transition-all duration-250 ease-in-out hover:bg-[#F9F4E6] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(212,175,55,0.15)] data-[state=active]:hover:bg-[#111111] data-[state=active]:hover:shadow-[0_6px_20px_rgba(212,175,55,0.25)] font-bold"
            >
              <TrendingUp className="h-4 w-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="gap-2 flex-1 data-[state=active]:bg-[#111111] data-[state=active]:text-[#D4AF37] data-[state=active]:border-[#D4AF37] data-[state=active]:shadow-[0_4px_16_rgba(212,175,55,0.2)] bg-white text-[#111827] border border-[#D4AF37] rounded-[10px] py-3.5 transition-all duration-250 ease-in-out hover:bg-[#F9F4E6] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(212,175,55,0.15)] data-[state=active]:hover:bg-[#111111] data-[state=active]:hover:shadow-[0_6px_20px_rgba(212,175,55,0.25)] font-bold"
            >
              <UserIcon className="h-4 w-4" /> Perfil
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="appointments" className="mt-0 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[#D4AF37] font-black uppercase text-xs tracking-[0.2em]">Agendamentos de Hoje</h2>
              <Button 
                size="sm"
                className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#D4AF37] rounded-[10px] font-black px-4 h-9 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => toast.info("Funcionalidade de novo agendamento disponível em breve no painel do profissional.")}
              >
                <Calendar className="h-4 w-4 mr-2 text-[#D4AF37]" /> Novo Agendamento
              </Button>
            </div>
            <div className="grid gap-4">
              {appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).length === 0 ? (
                <Card className="border-dashed border-[#D4AF37]/50 py-16 text-center bg-white rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
                  <CardContent className="flex flex-col items-center">
                    <Calendar className="h-16 w-16 text-[#D4AF37] opacity-20 mb-4" />
                    <p className="text-[#6B7280] font-medium">Nenhum atendimento para hoje.</p>
                  </CardContent>
                </Card>
              ) : (
                appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).map(app => (
                  <Card key={app.id} className="overflow-hidden bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px]">
                    <div className="flex flex-col md:flex-row md:items-center">
                      <div className="w-full md:w-32 bg-[#D4AF37]/5 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#D4AF37]/20">
                        <span className="text-3xl font-black text-[#111827]">{format(new Date(app.start_time), "HH:mm")}</span>
                        <span className="text-[10px] uppercase font-black text-[#D4AF37] tracking-wider mt-1">Hoje</span>
                      </div>
                      <div className="flex-1 p-6 flex items-center gap-4">
                        <Avatar className="h-12 w-12 border border-[#D4AF37]/10 shadow-sm">
                          <AvatarImage src={app.customers?.avatar_url} />
                          <AvatarFallback className="bg-[#D4AF37]/5 text-[#D4AF37] font-bold">{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-lg truncate text-[#111827]">{app.customers?.name || "Cliente"}</h4>
                          <p className="text-sm text-[#6B7280] flex items-center gap-2 font-medium">
                            <Scissors size={14} className="text-[#D4AF37]" /> {app.services?.name}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                           {app.status === 'cancelled' ? (
                             <Badge variant="outline" className="text-[10px] font-black px-2 py-0.5 text-zinc-400 border-zinc-200 bg-white">
                               SEM COBRANÇA
                             </Badge>
                           ) : (
                             <Badge variant={app.payment_status === 'paid' ? 'default' : 'outline'} className={cn(
                               "text-[10px] font-black px-2 py-0.5",
                               app.payment_status === 'paid' ? "bg-green-600 text-white border-transparent" : "text-[#D4AF37] border-[#D4AF37] bg-white"
                             )}>
                               {app.payment_status === 'paid' ? 'PAGO' : 'PENDENTE'}
                             </Badge>
                           )}
                          <span className="font-black text-lg text-[#111827]">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="p-6 bg-gray-50/50 flex items-center gap-3 border-t md:border-t-0 md:border-l border-[#D4AF37]/10">
                        {app.status === 'scheduled' || app.status === 'confirmed' ? (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleAction(app, 'completed')} 
                              className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#D4AF37] rounded-[10px] font-bold px-4 h-11 transition-all hover:scale-[1.02] active:scale-[0.98] flex-1"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2 text-[#D4AF37]" /> Concluir
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => { setSelectedAppointment(app); setShowCancelDialog(true); }} 
                              className="bg-white hover:bg-red-50 text-red-500 border-red-200 rounded-[10px] font-bold px-4 h-11 flex-1"
                            >
                              <X className="h-4 w-4 mr-2" /> Cancelar
                            </Button>
                            <Button 
                              size="sm"
                              className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#D4AF37] rounded-[10px] h-11 w-11 p-0 flex items-center justify-center transition-all hover:scale-[1.05]"
                              onClick={() => toast.info(`Detalhes de ${app.customers?.name}`)}
                            >
                              <Eye className="h-4 w-4 text-[#D4AF37]" />
                            </Button>
                          </>
                        ) : (
                          <Badge className={cn(
                            "w-full justify-center py-2 font-black rounded-[8px]",
                            app.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {app.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0 space-y-4">
            <Card className="bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
              <CardHeader className="border-b border-[#D4AF37]/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold text-[#111827]">Histórico de Atendimentos</CardTitle>
                  <CardDescription className="text-[#6B7280] font-medium">Lista completa dos seus serviços prestados.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="bg-[#111111] text-white border-[#D4AF37] rounded-[8px] h-9 px-4 font-bold transition-all hover:scale-[1.02]">Tudo</Button>
                  <Button variant="outline" size="sm" className="bg-white text-black border-[#D4AF37]/30 rounded-[8px] h-9 px-4 font-bold hover:bg-[#D4AF37]/5 transition-all">Este Mês</Button>
                  <Button variant="outline" size="sm" className="bg-white text-black border-[#D4AF37]/30 rounded-[8px] h-9 px-4 font-bold hover:bg-[#D4AF37]/5 transition-all">
                    <Filter className="h-4 w-4 mr-2 text-[#D4AF37]" /> Filtros
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50 border-b border-[#D4AF37]/10">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-black text-[#D4AF37] uppercase tracking-wider">Data</th>
                        <th className="px-6 py-4 text-left text-xs font-black text-[#D4AF37] uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-4 text-left text-xs font-black text-[#D4AF37] uppercase tracking-wider">Serviço</th>
                        <th className="px-6 py-4 text-left text-xs font-black text-[#D4AF37] uppercase tracking-wider">Valor</th>
                        <th className="px-6 py-4 text-left text-xs font-black text-[#D4AF37] uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D4AF37]/5 bg-white">
                      {appointments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-[#6B7280] italic font-medium">Nenhum atendimento registrado.</td>
                        </tr>
                      ) : (
                        appointments.slice(0, 10).map((app, index) => (
                          <tr key={app.id} className={cn(
                            "transition-colors hover:bg-[#D4AF37]/5",
                            index % 2 === 1 ? "bg-gray-50/30" : "bg-white"
                          )}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                                <span className="text-sm font-bold text-[#111827]">{format(new Date(app.start_time), "dd/MM/yyyy")}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 border border-[#D4AF37]/10">
                                  <AvatarImage src={app.customers?.avatar_url} />
                                  <AvatarFallback className="text-[10px] bg-[#D4AF37]/5 text-[#D4AF37] font-bold">{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-bold text-[#111827]">{app.customers?.name || "Cliente"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-[#6B7280] font-medium">{app.services?.name}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-black text-[#111827]">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-[6px]",
                                app.status === 'completed' ? "bg-green-100 text-green-700" :
                                app.status === 'cancelled' ? "bg-red-100 text-red-700" :
                                "bg-blue-100 text-blue-700"
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
                  <div className="bg-gray-50/50 p-4 border-t border-[#D4AF37]/10 flex items-center justify-between">
                    <p className="text-xs text-[#6B7280] font-bold">Mostrando 1-10 de {appointments.length} atendimentos</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-[8px] border-[#D4AF37] text-[#D4AF37] bg-white hover:bg-[#D4AF37]/5"><ChevronLeft size={18} /></Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-[8px] border-[#D4AF37] text-[#D4AF37] bg-white hover:bg-[#D4AF37]/5"><ChevronRight size={18} /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-[#D4AF37]/10 p-6">
                  <CardTitle className="text-xl font-bold text-[#111827]">Perfil Profissional</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowEditProfile(true)}
                    className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#D4AF37] rounded-[10px] font-bold px-4 h-10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Edit2 className="h-4 w-4 mr-2 text-[#D4AF37]" /> Editar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6 pt-8 px-6 pb-8">
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-28 w-28 border-4 border-[#D4AF37] shadow-xl">
                      <AvatarImage src={barber?.avatar_url} />
                      <AvatarFallback className="text-4xl font-black bg-[#D4AF37]/10 text-[#D4AF37]">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-[#111827]">{barber?.name}</h3>
                      <p className="text-sm text-[#D4AF37] font-black uppercase tracking-widest mt-1">{barber?.category || "Profissional"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6 pt-6 border-t border-[#D4AF37]/10">
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase text-[#D4AF37] tracking-wider">Bio / Descrição</p>
                      <p className="text-sm text-[#111827] leading-relaxed font-medium bg-gray-50 p-4 rounded-[10px] border border-gray-100">
                        {barber?.bio || "Sem descrição informada."}
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div className="flex items-center gap-4 text-sm text-[#111827] bg-[#D4AF37]/5 p-4 rounded-[10px] border border-[#D4AF37]/10 font-bold">
                        <Phone className="h-5 w-5 text-[#D4AF37]" />
                        <span>{barber?.phone || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#111827] bg-[#D4AF37]/5 p-4 rounded-[10px] border border-[#D4AF37]/10 font-bold">
                        <Mail className="h-5 w-5 text-[#D4AF37]" />
                        <span>{barber?.email || "Não informado"}</span>
                      </div>
                    </div>
                    {barber?.specialties && barber.specialties.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-black uppercase text-[#D4AF37] tracking-wider">Especialidades</p>
                        <div className="flex flex-wrap gap-2">
                          {barber.specialties.map((spec: string, i: number) => (
                            <Badge key={i} variant="outline" className="border-[#D4AF37]/30 text-[#111827] bg-white font-bold text-[10px] uppercase py-1 px-3 rounded-[6px]">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#D4AF37] shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-[#D4AF37]/10 p-6">
                  <CardTitle className="text-xl font-bold text-[#111827]">Horários</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowEditSchedule(true)}
                    className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#D4AF37] rounded-[10px] font-bold px-4 h-10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Edit2 className="h-4 w-4 mr-2 text-[#D4AF37]" /> Ajustar
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
                            "flex items-center justify-between p-4 rounded-[10px] border transition-all",
                            config.enabled ? "bg-white border-[#D4AF37]/30 shadow-sm" : "bg-gray-50 border-transparent opacity-50"
                          )}>
                            <span className="text-sm font-bold text-[#111827]">{dayNames[dayKey]}</span>
                            <div className="flex items-center gap-2 text-xs font-black bg-[#D4AF37]/10 text-[#D4AF37] px-4 py-1.5 rounded-full border border-[#D4AF37]/20 uppercase tracking-tighter">
                              {config.enabled ? `${config.start} - ${config.end}` : "Fechado"}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className="h-12 w-12 text-[#D4AF37] opacity-20 mb-4" />
                        <p className="text-[#6B7280] font-medium">Nenhum horário cadastrado.</p>
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
