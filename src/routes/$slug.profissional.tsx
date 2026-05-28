import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
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
  Wallet, 
  CheckCircle2, 
  X, 
  Edit2, 
  ArrowRight,
  User as UserIcon,
  Bell,
  BarChart3,
  LogOut,
  Check,
  RefreshCcw
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/$slug/profissional")({
  component: ProfessionalDashboard,
});

function ProfessionalDashboard() {
  const { session, loading, logout } = useProfessionalAuth();
  // Plan limits via hook (will be updated by our manual fetch if needed)
  const planLimits = usePlanLimits();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { slug } = Route.useParams();
  
  // State for real subscription data
  const [realSubscription, setRealSubscription] = useState<any>(null);
  const [realPlan, setRealPlan] = useState<string>("none");
  const [realCanAccess, setRealCanAccess] = useState<boolean>(true);
  const [accessReason, setAccessReason] = useState<string>("Verificando...");
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [foundTenantId, setFoundTenantId] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [barber, setBarber] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
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
      console.log("[profissional-access-debug] Starting validation for slug:", slug);

      try {
        // 1. Buscar tenant pelo slug na tabela profiles
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, plan, effective_plan, trial_end")
          .eq("slug", slug.toLowerCase())
          .maybeSingle();

        if (profileError || !profileData) {
          console.error("Tenant not found for slug:", slug);
          setAccessReason("Erro: Barbearia não encontrada para este endereço");
          setRealCanAccess(false);
          setIsDataLoading(false);
          return;
        }

        const tId = profileData.id;
        setFoundTenantId(tId);

        // 2. Buscar assinatura ativa na tabela subscriptions
        const { data: subData, error: subError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", tId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setRealSubscription(subData);

        // 3. Determinar o plano real
        const planId = (profileData.plan || profileData.effective_plan || "none").toLowerCase();
        setRealPlan(planId);

        // 4. Lógica de liberação
        const subStatus = (subData?.status || "none").toLowerCase();
        const now = new Date();
        const trialEnd = profileData.trial_end ? new Date(profileData.trial_end) : null;
        const isTrialValid = trialEnd ? trialEnd > now : false;

        // Regras do SaaS solicitadas pelo usuário:
        // 1. Assinatura explicitamente ativa na tabela subscriptions
        const isActiveSub = ['active', 'paid', 'trialing'].includes(subStatus);
        
        // 2. Plano pago (Elite, Pro, Starter) sem bloqueio explícito
        const isPaidPlan = ['starter', 'pro', 'elite'].includes(planId);
        const subNotBlocked = !['canceled', 'inactive', 'past_due'].includes(subStatus);
        const hasPaidPlanAccess = isPaidPlan && subNotBlocked;

        // Regra final: Libera se tiver assinatura ativa OU trial válido OU plano pago sem bloqueio
        const canAccess = isActiveSub || isTrialValid || hasPaidPlanAccess;
        
        setRealCanAccess(canAccess);
        
        if (canAccess) {
          if (isActiveSub) {
            setAccessReason("Liberado: Assinatura Ativa (Tabela Subscriptions)");
          } else if (isTrialValid) {
            setAccessReason("Liberado: Período de Teste Válido");
          } else if (hasPaidPlanAccess) {
            setAccessReason(`Liberado: Plano Pago (${planId}) detectado sem bloqueio`);
          } else {
            setAccessReason("Liberado: Acesso concedido");
          }
        } else {
          setAccessReason("Bloqueado: Período de teste expirado e sem plano pago ativo");
        }

        console.log("[profissional-access-debug] Validation result:", {
          tenant_id: tId,
          subStatus,
          isActiveSub,
          isTrialValid,
          isPaidPlan,
          hasPaidPlanAccess,
          canAccess,
          planId
        });

      } catch (err) {
        console.error("Error validating access:", err);
        setAccessReason("Erro técnico na validação do acesso");
      } finally {
        setIsDataLoading(false);
      }
    }

    validateAccess();
  }, [slug]);

  useEffect(() => {
    if (session?.barber_id) {
      console.log("ProfessionalDashboard: Loading data for barber", session.barber_id);
      fetchData();
      fetchNotifications();
      
      const channel = supabase
        .channel(`prof-realtime-${session.barber_id}-${Date.now()}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'appointments', 
          filter: `barber_id=eq.${session.barber_id}` 
        }, (payload: any) => {
          console.log('REALTIME PAYLOAD', payload);
          console.log('STATUS UPDATED', payload.new?.id, payload.new?.status);
          
          fetchData();
          
          // Invalida todas as queries relacionadas
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
          queryClient.invalidateQueries({ queryKey: ['calendar'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['customerAppointments'] });
          queryClient.invalidateQueries({ queryKey: ['calendar-appointments'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-appointments'] });
          queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
          queryClient.invalidateQueries({ queryKey: ['professional-dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['professional-appointments'] });
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'transactions', 
          filter: `barber_id=eq.${session.barber_id}` 
        }, (payload) => {
          console.log("Realtime: Transaction change detected", payload);
          fetchData();
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications', 
          filter: `barber_id=eq.${session.barber_id}` 
        }, (payload) => {
          console.log("Realtime: Notification change detected", payload);
          fetchNotifications();
        })
        .subscribe((status) => {
          console.log("Realtime subscription status:", status);
        });

      // Fallback polling every 20 seconds
      const pollInterval = setInterval(() => {
        fetchData();
        fetchNotifications();
      }, 20000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [session?.barber_id]);

  async function fetchData() {
    if (!session?.barber_id) return;

    const bId = session.barber_id;
    const now = new Date();
    
    // Use local day bounds to avoid timezone issues
    const tStart = startOfDay(now).toISOString();
    const tEnd = endOfDay(now).toISOString();
    const wStart = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
    const wEnd = endOfWeek(now, { weekStartsOn: 0 }).toISOString();
    const mStart = startOfMonth(now).toISOString();
    const mEnd = endOfMonth(now).toISOString();

    // Fetch Barber Info
    const { data: bData } = await supabase
      .from("barbers")
      .select("*")
      .eq("id", bId)
      .single();
    setBarber(bData);

    // Fetch Appointments for counts
    const { data: allApps } = await supabase
      .from("appointments")
      .select("id, start_time, status, total_price, final_amount, payment_status")
      .eq("barber_id", bId)
      .neq("status", "cancelled");

    if (allApps) {
      const todayCount = allApps.filter(a => a.start_time >= tStart && a.start_time <= tEnd).length;
      const weekCount = allApps.filter(a => a.start_time >= wStart && a.start_time <= wEnd).length;
      const monthCount = allApps.filter(a => a.start_time >= mStart && a.start_time <= mEnd).length;
      
      const completedApps = allApps.filter(a => a.status === 'completed');
      
      // Calculate revenue based on commission
      const commissionRate = bData?.commission_rate || 0;
      const totalRevenue = completedApps.reduce((acc, a) => {
        const amount = Number(a.total_price || 0);
        return acc + (amount * (commissionRate / 100));
      }, 0);

      const received = completedApps.filter(a => a.payment_status === 'paid').reduce((acc, a) => {
        const amount = Number(a.total_price || 0);
        return acc + (amount * (commissionRate / 100));
      }, 0);

      const pending = completedApps.filter(a => a.payment_status === 'pending').reduce((acc, a) => {
        const amount = Number(a.total_price || 0);
        return acc + (amount * (commissionRate / 100));
      }, 0);

      setStats({
        today: todayCount,
        week: weekCount,
        month: monthCount,
        revenue: totalRevenue,
        received,
        pending
      });
    }

    // Recent Appointments - Fetch ALL
    const { data: recentApps, error: appError } = await supabase
      .from("appointments")
      .select("*, customers(name, phone, avatar_url), services(name)")
      .eq("barber_id", bId)
      .order("start_time", { ascending: false });

    if (appError) {
      console.error("Error fetching appointments:", appError);
      toast.error("Erro ao carregar agendamentos.");
    } else {
      console.log("Professional Dashboard: Fetched", recentApps?.length, "appointments");
      setAppointments(recentApps || []);
    }

    // Recent Transactions
    const { data: recentTrans } = await supabase
      .from("transactions")
      .select("*, appointment:appointments(customers(name), services(name))")
      .eq("barber_id", bId)
      .order("created_at", { ascending: false })
      .limit(10);
    setTransactions(recentTrans || []);
  }

  async function fetchNotifications() {
    if (!session?.barber_id) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("barber_id", session.barber_id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) {
        console.error("Error fetching notifications:", error);
      } else if (data) {
        setNotifications(data);
      }
    } catch (e) {
      console.error("Exception in fetchNotifications:", e);
    }
  }

  async function markAsRead(id: string) {
    if (!id) return;
    
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) {
        console.error("Error marking as read:", error);
        toast.error("Erro ao marcar como lida");
      } else {
        // Update local state immediately for better UX
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        toast.success("Notificação lida");
        fetchNotifications();
      }
    } catch (e) {
      toast.error("Erro ao processar");
    }
  }

  const handleAction = async (app: any, status: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", app.id);
      
      if (error) throw error;
      
      if (status === 'completed') {
        toast.success("Atendimento concluído!");
      } else if (status === 'cancelled') {
        toast.success("Atendimento cancelado");
      }
      
      fetchData();

      // Realtime Invalidation
      console.log('STATUS UPDATED', app.id, status);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["professional-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["professional-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["customerAppointments"] });
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

  // Bloqueio definitivo se can_access for false (vindo da query manual)
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
  return (
    <AppLayout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/10">
              <AvatarImage src={barber?.avatar_url} />
              <AvatarFallback className="bg-primary/5 text-primary text-xl">
                {session.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Olá, {session.name} <span className="text-xl">👋</span>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {barber?.category || "Barbeiro"}
                </Badge>
                <div className="flex items-center gap-1">
                  <div className={cn("h-2 w-2 rounded-full", barber?.active ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-xs text-muted-foreground">{barber?.active ? "Disponível" : "Indisponível"}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                fetchData();
                fetchNotifications();
                toast.success("Dados atualizados");
              }}
              className="h-10 w-10 rounded-full border-primary/20 hover:bg-primary/5"
              title="Atualizar dados"
            >
              <RefreshCcw className="h-5 w-5 text-primary" />
            </Button>
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <Link to="/calendar">
                <Calendar className="mr-2 h-4 w-4" />
                Minha Agenda
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="overflow-hidden border-2 border-slate-100 shadow-sm bg-white text-black">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atendimentos</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Hoje • {stats.week} esta semana
              </p>
              <div className="mt-3">
                <Progress value={(stats.today / 15) * 100} className="h-1" />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-2 border-slate-100 shadow-sm bg-white text-black">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento (Comissão)</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.revenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Ref. {barber?.commission_rate || 0}% de comissão
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-2 border-slate-100 shadow-sm bg-white text-black">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recebido</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.received.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pagamentos confirmados
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-2 border-slate-100 shadow-sm bg-white text-black">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendente</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.pending.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aguardando pagamento
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="appointments" className="gap-2 rounded-lg">
              <Calendar className="h-4 w-4" /> Próximos Atendimentos
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 rounded-lg">
              <BarChart3 className="h-4 w-4" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 rounded-lg">
              <UserIcon className="h-4 w-4" /> Perfil & Horários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Agenda do Dia</h2>
              <Button variant="link" size="sm" asChild>
                <Link to="/calendar">Ver agenda completa <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
            
            <div className="grid gap-4">
               {appointments.filter(a => {
                  const appDate = new Date(a.start_time);
                  const today = new Date();
                  return (
                    appDate.getDate() === today.getDate() &&
                    appDate.getMonth() === today.getMonth() &&
                    appDate.getFullYear() === today.getFullYear()
                  );
                }).length === 0 ? (
                <div className="space-y-4">
                  <Card className="border-dashed py-12 bg-white text-black border-2 border-slate-100 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center text-muted-foreground text-center">
                      <Calendar className="h-12 w-12 opacity-20 mb-4" />
                      <p className="font-medium">Nenhum atendimento para hoje.</p>
                      <p className="text-xs mt-1">Veja abaixo os próximos agendamentos:</p>
                    </CardContent>
                  </Card>
                  
                  {appointments.filter(a => new Date(a.start_time) > new Date()).slice(0, 5).map(app => (
                    <Card key={app.id} className="hover:shadow-md transition-shadow group overflow-hidden border-2 border-slate-100 bg-white text-black">
                      <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row md:items-center">
                          <div className="w-full md:w-32 bg-muted/30 p-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r">
                            <span className="text-2xl font-black text-primary">{format(new Date(app.start_time), "HH:mm")}</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">{format(new Date(app.start_time), "EEE, d 'de' MMM", { locale: ptBR })}</span>
                          </div>
                          
                          <div className="flex-1 p-4 flex items-center gap-4">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={app.customers?.avatar_url} />
                              <AvatarFallback>{app.customers?.name?.substring(0, 2).toUpperCase() || "C"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold truncate">{app.customers?.name || "Cliente"}</h4>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Scissors size={12} /> {app.services?.name}
                              </p>
                            </div>
                            <div className="text-right">
                               <p className="font-bold text-sm text-primary">Próximo</p>
                               <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(app.start_time), { addSuffix: true, locale: ptBR })}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                 appointments.filter(a => {
                   const appDate = new Date(a.start_time);
                   const today = new Date();
                   return (
                     appDate.getDate() === today.getDate() &&
                     appDate.getMonth() === today.getMonth() &&
                     appDate.getFullYear() === today.getFullYear()
                   );
                 }).map(app => (
                  <Card key={app.id} className="hover:shadow-md transition-shadow group overflow-hidden border-2 border-slate-100 bg-white text-black">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center">
                        <div className="w-full md:w-32 bg-muted/30 p-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r">
                          <span className="text-2xl font-black text-primary">{format(parseISO(app.start_time), "HH:mm")}</span>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">{format(parseISO(app.start_time), "EEE, d 'de' MMM", { locale: ptBR })}</span>
                        </div>
                        
                        <div className="flex-1 p-4 flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={app.customers?.avatar_url} />
                            <AvatarFallback>{app.customers?.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold truncate">{app.customers?.name}</h4>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Scissors size={12} /> {app.services?.name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={app.payment_status === 'paid' ? 'default' : 'outline'} className={cn(
                              "text-[10px]",
                              app.payment_status === 'paid' ? 'bg-green-600' : 'text-amber-600 border-amber-200 bg-amber-50'
                            )}>
                              {app.payment_status === 'paid' ? 'PAGO' : 'PENDENTE'}
                            </Badge>
                            <span className="font-bold text-sm">R$ {app.total_price.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="p-4 bg-muted/10 flex items-center gap-2 border-t md:border-t-0 md:border-l">
                          {app.status === 'scheduled' || app.status === 'confirmed' ? (
                            <>
                              <Button size="sm" className="h-8 bg-black text-white hover:scale-105 transition-all" onClick={() => handleAction(app, 'completed')}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleAction(app, 'cancelled')}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Badge className={cn(
                              app.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            )}>
                              {app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-6">
             <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-white border-2 border-slate-100 shadow-sm text-black">

                  <CardHeader>
                    <CardTitle className="text-lg">Extrato Recente</CardTitle>
                    <CardDescription>Suas últimas entradas e comissões.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      <div className="divide-y">
                        {transactions.length === 0 ? (
                          <div className="py-12 text-center text-muted-foreground italic">
                            Nenhum registro encontrado.
                          </div>
                        ) : (
                          transactions.map(t => (
                            <div key={t.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center",
                                  t.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                )}>
                                  {t.type === 'income' ? <TrendingUp size={14} /> : <X size={14} />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold truncate max-w-[180px]">
                                    {t.appointment?.services?.name || t.description}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {t.appointment?.customers?.name} • {format(parseISO(t.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={cn("text-sm font-bold", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                                  {t.type === 'income' ? "+" : "-"} R$ {t.amount.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Comissão: R$ {(t.amount * (barber?.commission_rate || 0) / 100).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="bg-white border-2 border-slate-100 shadow-sm text-black">

                  <CardHeader>
                    <CardTitle className="text-lg">Resumo de Ganhos</CardTitle>
                    <CardDescription>Distribuição do faturamento gerado.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Gerado (Serviços)</span>
                        <span className="font-bold text-primary">R$ {(stats.revenue / (barber?.commission_rate || 1) * 100).toFixed(2)}</span>
                      </div>
                      <Progress value={barber?.commission_rate || 0} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Minha Parte ({barber?.commission_rate}%)</span>
                        <span>Loja ({100 - (barber?.commission_rate || 0)}%)</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-3">
                      <h4 className="text-sm font-bold">Top Clientes</h4>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                             <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">#{i}</div>
                             <span className="text-xs">Cliente Exemplo {i}</span>
                          </div>
                          <span className="text-xs font-bold">{10 - i} atendimentos</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-white border-2 border-slate-100 shadow-sm text-black">

                <CardHeader>
                  <CardTitle className="text-lg">Meu Perfil Profissional</CardTitle>
                  <CardDescription>Como você aparece para os clientes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex flex-col items-center gap-4 py-4">
                      <div className="relative group">
                        <Avatar className="h-24 w-24 border-4 border-primary/20 transition-transform group-hover:scale-105">
                          <AvatarImage src={barber?.avatar_url} />
                          <AvatarFallback className="text-3xl">{session.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <Button variant="outline" size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg bg-card">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold">{session.name}</h3>
                        <p className="text-sm text-muted-foreground">{barber?.category || "Barbeiro"}</p>
                      </div>
                   </div>

                   <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium">WhatsApp</span>
                        <span className="text-sm text-muted-foreground">{barber?.phone || "Não informado"}</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium">Email</span>
                        <span className="text-sm text-muted-foreground">{barber?.email || "Não informado"}</span>
                      </div>
                      <Button className="w-full mt-4" variant="outline" asChild>
                         <Link to="/settings">
                            Editar Dados Públicos
                         </Link>
                      </Button>
                   </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-slate-100 shadow-sm text-black">
                <CardHeader>
                  <CardTitle className="text-lg">Horários & Disponibilidade</CardTitle>
                  <CardDescription>Gerencie seus turnos de trabalho.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-4">
                      {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day) => (
                        <div key={day} className="flex items-center justify-between p-3 rounded-xl border bg-muted/10">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-sm font-bold">{day}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1 rounded-full border shadow-sm">
                            <span>08:00</span>
                            <span className="opacity-30">|</span>
                            <span>18:00</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button className="w-full mt-6" variant="secondary" asChild>
                    <Link to="/barbers">
                      Alterar Escala de Trabalho
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}


export default ProfessionalDashboard;
