import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, 
  CircleDollarSign, 
  Clock, 
  Users, 
  Scissors, 
  TrendingUp, 
  X, 
  Edit2, 
  ArrowRight,
  User as UserIcon,
  BarChart3,
  LogOut,
  RefreshCcw,
  CheckCircle2,
  Phone,
  Mail,
  UserCheck
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/$slug/profissional")({
  component: ProfessionalDashboard,
});

function ProfessionalDashboard() {
  const { session, loading, logout } = useProfessionalAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { slug } = Route.useParams();
  
  const [realCanAccess, setRealCanAccess] = useState<boolean>(true);
  const [accessReason, setAccessReason] = useState<string>("Verificando...");
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barber, setBarber] = useState<any>(null);
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    month: 0,
    revenueMonth: 0,
    commissionMonth: 0,
    avgTicket: 0,
    customerCount: 0,
    nextAppointment: null as any
  });

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    async function validateAccess() {
      if (!slug) return;
      setIsDataLoading(true);

      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, plan, effective_plan, trial_end")
          .eq("slug", slug.toLowerCase())
          .maybeSingle();

        if (!profileData) {
          setAccessReason("Barbearia não encontrada.");
          setRealCanAccess(false);
          setIsDataLoading(false);
          return;
        }

        const tId = profileData.id;

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", tId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const planId = (profileData.plan || profileData.effective_plan || "none").toLowerCase();
        const subStatus = (subData?.status || "none").toLowerCase();
        const now = new Date();
        const trialEnd = profileData.trial_end ? new Date(profileData.trial_end) : null;
        const isTrialValid = trialEnd ? trialEnd > now : false;

        const isActiveSub = ['active', 'paid', 'trialing'].includes(subStatus);
        const isPaidPlan = ['starter', 'pro', 'elite'].includes(planId);
        const subNotBlocked = !['canceled', 'inactive', 'past_due'].includes(subStatus);
        const hasPaidPlanAccess = isPaidPlan && subNotBlocked;

        const canAccess = isActiveSub || isTrialValid || hasPaidPlanAccess;
        setRealCanAccess(canAccess);
        
        if (!canAccess) {
          setAccessReason("Sua barbearia precisa de uma assinatura ativa para liberar o acesso profissional.");
        }
      } catch (err) {
        console.error("Error validating access:", err);
      } finally {
        setIsDataLoading(false);
      }
    }

    validateAccess();
  }, [slug]);

  useEffect(() => {
    if (session?.barber_id) {
      fetchData();
      
      const channel = supabase
        .channel(`prof-realtime-${session.barber_id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'appointments', 
          filter: `barber_id=eq.${session.barber_id}` 
        }, () => {
          fetchData();
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session?.barber_id]);

  async function fetchData() {
    if (!session?.barber_id) return;

    const bId = session.barber_id;
    const now = new Date();
    
    const tStart = startOfDay(now).toISOString();
    const tEnd = endOfDay(now).toISOString();
    const wStart = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
    const wEnd = endOfWeek(now, { weekStartsOn: 0 }).toISOString();
    const mStart = startOfMonth(now).toISOString();
    const mEnd = endOfMonth(now).toISOString();

    try {
      const { data: bData } = await supabase
        .from("barbers")
        .select("*")
        .eq("id", bId)
        .single();
      setBarber(bData);

      const { data: allApps } = await supabase
        .from("appointments")
        .select("*, customers(name, phone, avatar_url), services(name)")
        .eq("barber_id", bId);

      if (allApps) {
        const todayCount = allApps.filter(a => a.start_time >= tStart && a.start_time <= tEnd && a.status !== 'cancelled').length;
        const weekCount = allApps.filter(a => a.start_time >= wStart && a.start_time <= wEnd && a.status !== 'cancelled').length;
        const monthApps = allApps.filter(a => a.start_time >= mStart && a.start_time <= mEnd && a.status !== 'cancelled');
        
        const monthCompletedApps = monthApps.filter(a => a.status === 'completed');
        
        const totalRevenueMonth = monthCompletedApps.reduce((acc, a) => acc + Number(a.total_price || 0), 0);
        const commissionRate = bData?.commission_rate || 0;
        const commissionMonth = totalRevenueMonth * (commissionRate / 100);
        
        const distinctCustomers = new Set(allApps.filter(a => a.status === 'completed').map(a => a.customer_id)).size;
        const avgTicket = monthCompletedApps.length > 0 ? totalRevenueMonth / monthCompletedApps.length : 0;

        const nextApp = allApps
          .filter(a => new Date(a.start_time) > now && a.status === 'scheduled')
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

        setStats({
          today: todayCount,
          week: weekCount,
          month: monthApps.length,
          revenueMonth: totalRevenueMonth,
          commissionMonth: commissionMonth,
          avgTicket: avgTicket,
          customerCount: distinctCustomers,
          nextAppointment: nextApp
        });

        setAppointments([...allApps].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  }

  const handleAction = async (app: any, status: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", app.id);
      
      if (error) throw error;
      
      toast.success(status === 'completed' ? "Atendimento concluído!" : "Status atualizado");
      fetchData();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  if (loading || isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!session) return null;

  if (!realCanAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <Card className="max-w-md w-full border-2 border-primary/20 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-xl text-primary">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">{accessReason}</p>
              <Button className="w-full" asChild>
                <Link to="/subscription">Ver Planos de Assinatura</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

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
      <div className="space-y-8 pb-12 px-4 md:px-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/10 shadow-sm">
              <AvatarImage src={barber?.avatar_url} />
              <AvatarFallback className="bg-primary/5 text-primary text-xl">
                {session.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">Olá, {session.name} 👋</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {barber?.category || "Profissional"}
                </Badge>
                <div className="flex items-center gap-1">
                  <div className={cn("h-2 w-2 rounded-full", barber?.active ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-xs text-muted-foreground">{barber?.active ? "Disponível" : "Indisponível"}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchData} className="h-10 w-10 rounded-full border-primary/20 hover:bg-primary/5">
              <RefreshCcw className="h-5 w-5 text-primary" />
            </Button>
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <Link to="/calendar">
                <Calendar className="mr-2 h-4 w-4" /> Agenda
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Atendimentos Hoje</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.week} esta semana</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Mês</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.revenueMonth.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Minha parte: R$ {stats.commissionMonth.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.avgTicket.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Clientes: {stats.customerCount}</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Próximo Cliente</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {stats.nextAppointment ? format(new Date(stats.nextAppointment.start_time), "HH:mm") : "---"}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {stats.nextAppointment ? `Com ${stats.nextAppointment.customers?.name || 'Cliente'}` : "Sem agendamentos"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl w-full md:w-auto">
            <TabsTrigger value="appointments" className="gap-2 rounded-lg flex-1 md:flex-none">
              <Calendar className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 rounded-lg flex-1 md:flex-none">
              <BarChart3 className="h-4 w-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 rounded-lg flex-1 md:flex-none">
              <UserIcon className="h-4 w-4" /> Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="mt-6 space-y-4">
            <div className="grid gap-4">
              {appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).length === 0 ? (
                <Card className="border-dashed py-12 text-center bg-muted/5">
                  <CardContent className="flex flex-col items-center">
                    <Calendar className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                    <p className="text-muted-foreground">Nenhum atendimento para hoje.</p>
                  </CardContent>
                </Card>
              ) : (
                appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).map(app => (
                  <Card key={app.id} className="overflow-hidden border shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center">
                      <div className="w-full md:w-32 bg-muted/30 p-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r">
                        <span className="text-2xl font-black text-primary">{format(new Date(app.start_time), "HH:mm")}</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Hoje</span>
                      </div>
                      <div className="flex-1 p-4 flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={app.customers?.avatar_url} />
                          <AvatarFallback>{app.customers?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold truncate">{app.customers?.name || "Cliente"}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Scissors size={12} /> {app.services?.name}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Badge variant={app.payment_status === 'paid' ? 'default' : 'outline'} className={cn(
                            "text-[10px]",
                            app.payment_status === 'paid' ? "bg-green-600" : "text-amber-600 bg-amber-50"
                          )}>
                            {app.payment_status === 'paid' ? 'PAGO' : 'PENDENTE'}
                          </Badge>
                          <span className="font-bold text-sm">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-muted/10 flex items-center gap-2 border-t md:border-t-0 md:border-l">
                        {app.status === 'scheduled' || app.status === 'confirmed' ? (
                          <Button size="sm" onClick={() => handleAction(app, 'completed')} className="bg-primary hover:bg-primary/90">
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
                          </Button>
                        ) : (
                          <Badge className={cn(
                            app.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-4">
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Histórico de Atendimentos</CardTitle>
                <CardDescription>Lista completa dos seus serviços prestados.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="divide-y">
                    {appointments.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground italic">Nenhum atendimento registrado.</div>
                    ) : (
                      appointments.map(app => (
                        <div key={app.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-muted flex flex-col items-center justify-center text-center">
                              <span className="text-xs font-bold leading-none">{format(new Date(app.start_time), "dd")}</span>
                              <span className="text-[10px] uppercase text-muted-foreground">{format(new Date(app.start_time), "MMM", { locale: ptBR })}</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm">{app.customers?.name || "Cliente"}</p>
                              <p className="text-xs text-muted-foreground">{app.services?.name} • {format(new Date(app.start_time), "HH:mm")}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between md:justify-end gap-6">
                            <div className="text-right">
                              <p className="text-sm font-bold">R$ {Number(app.total_price || 0).toFixed(2)}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{app.payment_method || "Não informado"}</p>
                            </div>
                            <div className="w-24 text-right">
                              <Badge className={cn(
                                "text-[10px]",
                                app.status === 'completed' ? "bg-green-100 text-green-700" :
                                app.status === 'cancelled' ? "bg-red-100 text-red-700" :
                                "bg-blue-100 text-blue-700"
                              )}>
                                {app.status === 'completed' ? 'CONCLUÍDO' : 
                                 app.status === 'cancelled' ? 'CANCELADO' : 'AGENDADO'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle>Perfil Profissional</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4 py-4">
                    <Avatar className="h-24 w-24 border-4 border-primary/10">
                      <AvatarImage src={barber?.avatar_url} />
                      <AvatarFallback className="text-3xl">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <h3 className="text-xl font-bold">{session.name}</h3>
                      <p className="text-sm text-muted-foreground">{barber?.category || "Profissional"}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 pt-4 border-t">
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-primary" />
                      <span>{barber?.phone || "Não informado"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>{barber?.email || "Não informado"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <UserCheck className="h-4 w-4 text-primary" />
                      <span className={cn(barber?.active ? "text-green-600" : "text-red-600")}>
                        {barber?.active ? "Perfil Ativo" : "Perfil Inativo"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle>Horários de Atendimento</CardTitle>
                  <CardDescription>Seus turnos configurados na barbearia.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-3">
                      {barber?.working_hours ? (
                        sortedDays.map(dayKey => {
                          const config = barber.working_hours[dayKey];
                          if (!config) return null;
                          return (
                            <div key={dayKey} className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-colors",
                              config.enabled ? "bg-primary/5 border-primary/10" : "bg-muted/20 border-transparent opacity-50"
                            )}>
                              <span className="text-sm font-bold">{dayNames[dayKey]}</span>
                              <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1 rounded-full border shadow-sm">
                                {config.enabled ? `${config.start} - ${config.end}` : "Fechado"}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Nenhum horário cadastrado.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export default ProfessionalDashboard;
