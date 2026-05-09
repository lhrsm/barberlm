import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Scissors, 
  Calendar, 
  CircleDollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Crown,
  Zap,
  Bell,
  ExternalLink,
  Clock,
  User as UserIcon,
  Copy,
  Globe,
  Wallet,
  RefreshCcw,
  CheckCircle2, 
  XCircle,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, formatDistanceToNow, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// Removidos duplicados importados acima

export const Route = createFileRoute("/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plan, usage, limits } = usePlanLimits();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    daily: {
      appointments: 0,
      totalServicesValue: 0, // Valor total dos serviços (Receita Operacional)
      realCashInflow: 0,     // Entrada real em caixa (PIX/Dinheiro)
      creditsUsed: 0,        // Créditos utilizados
      newCustomers: 0
    },
    monthly: {
      appointments: 0,
      totalServicesValue: 0,
      realCashInflow: 0,
      creditsUsed: 0,
      newCustomers: 0
    },
    total: {
      customers: 0,
      services: 0,
      customerCredits: 0
    }
  });
  const [barbers, setBarbers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchNotifications();
      fetchTodayAppointments();
    }
  }, [user, statusFilter, selectedDate]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setNotifications(data);
  }

  async function fetchTodayAppointments() {
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();
    
    let query = supabase
      .from("appointments")
      .select("*, customers(name, phone, loyalty_points, avatar_url), services(name), barbers(name)")
      .or(`status.neq.cancelled,refund_status.eq.pending`)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query.order("start_time", { ascending: true });
    if (data) setTodayAppointments(data);
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    fetchNotifications();
  }

  async function completeAppointment(appointment: any) {
    if (appointment.status === 'completed') return;

    // 1. Update appointment status
    const { error } = await supabase
      .from("appointments")
      .update({ status: 'completed' })
      .eq("id", appointment.id);

    if (error) {
      toast.error("Erro ao concluir agendamento");
      return;
    }

    // 2. Increment loyalty points for the customer
    if (appointment.customer_id) {
      const currentPoints = appointment.customers?.loyalty_points || 0;
      await supabase
        .from("customers")
        .update({ loyalty_points: currentPoints + 1 })
        .eq("id", appointment.customer_id);
    }

    // 3. Handle financial registration (Only if paid)
    if (appointment.payment_status === 'paid') {
      const totalPrice = Number(appointment.original_total || appointment.total_price || 0);
      const usedCredits = Number(appointment.credit_used || 0);
      const remainingToPay = Number(appointment.final_amount || 0);
      
      // Check if a transaction for this appointment already exists to avoid duplicates
      const { data: existingTrans } = await supabase
        .from("transactions")
        .select("id")
        .eq("appointment_id", appointment.id)
        .maybeSingle();

      if (!existingTrans) {
        // Criar uma ÚNICA transação para registro financeiro (mesmo se valor for 0 para constar no operacional)
        const creditText = usedCredits > 0 ? ` (Abatimento Créditos: R$ ${usedCredits.toFixed(2)})` : "";
        
        const { error: transError } = await supabase
          .from("transactions")
          .insert({
            amount: remainingToPay,
            type: "income",
            description: `Atendimento${creditText}: ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'}`,
            category: "Serviço",
            barber_id: appointment.barber_id,
            appointment_id: appointment.id,
            user_id: user?.id || "",
            date: new Date().toISOString().split('T')[0]
          });
        
        if (transError) console.error("Error creating transaction:", transError);
      }
    }

    toast.success("Agendamento concluído e fidelidade incrementada!");
    fetchTodayAppointments();
    fetchStats();
  }

  async function togglePaymentStatus(appointment: any) {
    const newStatus = appointment.payment_status === 'paid' ? 'pending' : 'paid';
    
    // If marking as paid, and appointment is already completed, ensure it exists in transactions
    if (newStatus === 'paid' && appointment.status === 'completed') {
      const remainingToPay = Number(appointment.final_amount || appointment.total_price || 0);
      const usedCredits = Number(appointment.credit_used || 0);
      
      if (remainingToPay > 0) {
        const creditText = usedCredits > 0 ? ` (Abatimento Créditos: R$ ${usedCredits.toFixed(2)})` : "";
        
        const { error: transError } = await supabase
          .from("transactions")
          .insert({
            amount: remainingToPay,
            type: "income",
            description: `Atendimento${creditText}: ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'}`,
            category: "Serviço",
            barber_id: appointment.barber_id,
            appointment_id: appointment.id,
            user_id: user?.id || "",
            date: new Date().toISOString().split('T')[0]
          });
        
        if (transError) console.error("Error creating transaction on payment status toggle:", transError);
      }
    } else if (newStatus === 'pending') {
      // If marking as pending, remove from transactions
      await supabase
        .from("transactions")
        .delete()
        .eq("appointment_id", appointment.id);
    }

    const { error } = await supabase
      .from("appointments")
      .update({ payment_status: newStatus })
      .eq("id", appointment.id);

    if (error) {
      toast.error("Erro ao atualizar status de pagamento");
      return;
    }

    toast.success(`Pagamento marcado como ${newStatus === 'paid' ? 'pago' : 'pendente'}`);
    fetchTodayAppointments();
    fetchStats();
  }

  async function cancelAppointment(appointmentId: string) {
    if (!confirm("Deseja realmente cancelar este agendamento?")) return;

    const appointment = todayAppointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointmentId);

    if (error) {
      toast.error("Erro ao cancelar agendamento");
      return;
    }

    // Se o agendamento foi pago via Pix e o cliente solicitou reembolso/crédito
    if (appointment.payment_status === 'paid') {
      const totalPrice = Number(appointment.total_price || 0);
      
      if (appointment.refund_type === 'refund') {
        // Estorno: Remove da receita (cria uma saída/despesa para abater)
        await supabase.from("transactions").insert({
          amount: totalPrice,
          type: "expense",
          description: `Estorno (Cancelamento Pix): ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'}`,
          category: "Estorno",
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          user_id: user?.id || "",
          date: new Date().toISOString().split('T')[0]
        });
        toast.success("Agendamento cancelado e estorno registrado como saída!");
      } else if (appointment.refund_type === 'credits') {
        // Créditos: Adiciona ao saldo do cliente
        try {
          // 1. Garantir que o cliente tem uma carteira
          let { data: wallet } = await supabase
            .from("wallet")
            .select("id")
            .eq("customer_id", appointment.customer_id)
            .maybeSingle();
            
          if (!wallet) {
            const { data: newWallet, error: walletErr } = await supabase
              .from("wallet")
              .insert({ 
                customer_id: appointment.customer_id, 
                user_id: user?.id || "",
                balance: 0 
              })
              .select()
              .single();
            if (walletErr) throw walletErr;
            wallet = newWallet;
          }

          // 2. Adicionar crédito à carteira
          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            amount: totalPrice,
            type: "credit",
            description: `Crédito por cancelamento: ${appointment.services?.name || 'Serviço'}`,
            appointment_id: appointment.id,
            user_id: user?.id || ""
          });

          // 3. Registrar na transação como 0 para não contar como receita nova nem saída, 
          // mas documentar o movimento. O valor original de 'income' continua lá, 
          // mas agora o cliente tem o crédito para usar.
          // Usando valor total original para o crédito
          await supabase.from("transactions").insert({
            amount: 0,
            type: "income",
            description: `Crédito Gerado: ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'} (R$ ${totalPrice.toFixed(2)})`,
            category: "Crédito Cliente",
            barber_id: appointment.barber_id,
            appointment_id: appointment.id,
            user_id: user?.id || "",
            date: new Date().toISOString().split('T')[0]
          });

          toast.success("Agendamento cancelado e valor convertido em créditos!");
        } catch (err) {
          console.error("Erro ao gerar créditos:", err);
          toast.error("Erro ao converter valor em créditos.");
        }
      } else {
        // Fallback: se não tiver tipo de reembolso definido, registra como despesa (estorno padrão)
        await supabase.from("transactions").insert({
          amount: totalPrice,
          type: "expense",
          description: `Cancelamento: ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'}`,
          category: "Cancelamento",
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          user_id: user?.id || "",
          date: new Date().toISOString().split('T')[0]
        });
        toast.success("Agendamento cancelado!");
      }
    } else {
      toast.success("Agendamento cancelado!");
    }

    fetchTodayAppointments();
    fetchStats();
  }

  async function fetchStats() {
    if (!user) return;
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const [
      dailyApp, 
      monthlyApp, 
      dailyTrans, 
      monthlyTrans,
      dailyCust,
      monthlyCust,
      totalCust,
      totalServ,
      barbersData,
      profileData,
      walletData,
      dailyAppointmentsData,
      monthlyAppointmentsData
    ] = await Promise.all([
      supabase.from("appointments").select("*", { count: "exact", head: true }).neq("status", "cancelled").gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("*", { count: "exact", head: true }).neq("status", "cancelled").gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("transactions").select("amount").eq("type", "income").gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("transactions").select("amount").eq("type", "income").gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("services").select("*", { count: "exact", head: true }),
      supabase.from("barbers").select("*").eq("active", true).limit(5),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("wallet").select("balance"),
      supabase.from("appointments").select("total_price, credit_used, final_amount").neq("status", "cancelled").gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("total_price, credit_used, final_amount").neq("status", "cancelled").gte("start_time", monthStart).lte("start_time", monthEnd)
    ]);

    const totalCredits = walletData.data?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

    setBarbers(barbersData.data || []);
    setProfile(profileData.data);

    // Cálculos Diários
    const dailyServicesValue = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0) || 0;
    const dailyCreditsUsed = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.credit_used || 0), 0) || 0;
    const dailyCashInflow = dailyTrans.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    // Cálculos Mensais
    const monthlyServicesValue = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0) || 0;
    const monthlyCreditsUsed = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.credit_used || 0), 0) || 0;
    const monthlyCashInflow = monthlyTrans.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    setStats({
      daily: {
        appointments: dailyApp.count || 0,
        totalServicesValue: dailyServicesValue,
        realCashInflow: dailyCashInflow,
        creditsUsed: dailyCreditsUsed,
        newCustomers: dailyCust.count || 0
      },
      monthly: {
        appointments: monthlyApp.count || 0,
        totalServicesValue: monthlyServicesValue,
        realCashInflow: monthlyCashInflow,
        creditsUsed: monthlyCreditsUsed,
        newCustomers: monthlyCust.count || 0
      },
      total: {
        customers: totalCust.count || 0,
        services: totalServ.count || 0,
        customerCredits: totalCredits
      }
    });
  }

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Painel de Controle</h2>
            <p className="text-muted-foreground">Visão geral do desempenho da sua barbearia.</p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell size={20} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b">
                  <h4 className="font-semibold">Notificações</h4>
                </div>
                <ScrollArea className="h-[300px]">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhuma notificação encontrada.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-4 border-b hover:bg-muted/50 transition-colors cursor-pointer ${!n.read ? 'bg-primary/5' : ''}`}
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.link) navigate({ to: n.link });
                        }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className={`text-sm ${!n.read ? 'font-bold' : 'font-medium'}`}>{n.title}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Button onClick={() => navigate({ to: "/calendar" })} className="gap-2">
              <Calendar size={18} /> Novo Agendamento
            </Button>
          </div>
        </div>
        
        {profile?.slug && (
          <Card className="bg-primary/5 border-primary/20 overflow-hidden">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Sua Página de Agendamento</h3>
                  <p className="text-xs text-muted-foreground">
                    {window.location.origin}/{profile.slug}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 sm:flex-none gap-2"
                  onClick={() => {
                    const url = `${window.location.origin}/${profile.slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy size={14} /> Copiar Link
                </Button>
                <Button variant="default" size="sm" className="flex-1 sm:flex-none gap-2" asChild>
                  <a href={`/${profile.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Abrir Página
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-6">
          <Card className="col-span-4 bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Plano {plan === 'pro' ? 'Pro' : 'Grátis'}</CardTitle>
                  <CardDescription>Status dos recursos da sua barbearia</CardDescription>
                </div>
                {plan === 'pro' ? <Crown className="w-5 h-5 text-yellow-500" /> : <Zap className="w-5 h-5 text-blue-500" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Profissionais</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-bold leading-none">{usage.barbers}</span>
                    <span className="text-[10px] text-muted-foreground">/ {limits.barbers === Infinity ? "∞" : limits.barbers}</span>
                  </div>
                  <Progress value={limits.barbers === Infinity ? 100 : (usage.barbers / limits.barbers) * 100} className="h-1" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Serviços</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-bold leading-none">{usage.services}</span>
                    <span className="text-[10px] text-muted-foreground">/ {limits.services === Infinity ? "∞" : limits.services}</span>
                  </div>
                  <Progress value={limits.services === Infinity ? 100 : (usage.services / limits.services) * 100} className="h-1" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Agenda (Mês)</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-bold leading-none">{usage.monthlyAppointments}</span>
                    <span className="text-[10px] text-muted-foreground">/ {limits.monthlyAppointments === Infinity ? "∞" : limits.monthlyAppointments}</span>
                  </div>
                  <Progress value={limits.monthlyAppointments === Infinity ? 100 : (usage.monthlyAppointments / limits.monthlyAppointments) * 100} className="h-1" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">WhatsApp</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-bold leading-none">{usage.whatsappConnections}</span>
                    <span className="text-[10px] text-muted-foreground">/ {limits.whatsappConnections === Infinity ? "∞" : limits.whatsappConnections}</span>
                  </div>
                  <Progress value={limits.whatsappConnections === Infinity ? 100 : (usage.whatsappConnections / limits.whatsappConnections) * 100} className="h-1" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Créditos Clientes</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-bold leading-none">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.total.customerCredits)}
                    </span>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg text-primary w-fit">
                    <Wallet size={14} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-3 flex flex-col justify-center bg-card">
            <CardContent className="py-4 text-center space-y-2">
              {plan === 'free' ? (
                <>
                  <p className="text-sm font-medium">Precisando de mais recursos?</p>
                  <Button size="sm" className="w-full" asChild>
                    <Link to="/subscription">Fazer Upgrade para Pro</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-primary">Você possui todos os recursos liberados!</p>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to="/subscription">Gerenciar Assinatura</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="daily">Hoje</TabsTrigger>
            <TabsTrigger value="monthly">Este Mês</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">
                  {isSameDay(selectedDate, new Date()) ? "Agendamentos de Hoje" : `Agendamentos de ${format(selectedDate, "dd/MM")}`}
                </h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar size={14} />
                      Filtrar Data
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={statusFilter === "all" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  Todos
                </Button>
                <Button 
                  variant={statusFilter === "scheduled" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setStatusFilter("scheduled")}
                >
                  Agendados
                </Button>
                <Button 
                  variant={statusFilter === "completed" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setStatusFilter("completed")}
                >
                  Concluídos
                </Button>
                <Button 
                  variant={statusFilter === "cancelled" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setStatusFilter("cancelled")}
                >
                  Cancelados
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-blue-50/50 border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700">Serviços Vendidos Hoje</CardTitle>
                  <Scissors className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">R$ {stats.daily.totalServicesValue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Valor total dos serviços</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50/50 border-green-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700">Entrada em Caixa Hoje</CardTitle>
                  <CircleDollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">R$ {stats.daily.realCashInflow.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Dinheiro novo (PIX/Dinheiro)</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50/50 border-purple-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700">Créditos Utilizados Hoje</CardTitle>
                  <Wallet className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700">R$ {stats.daily.creditsUsed.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Abatido de saldos anteriores</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.daily.appointments}</div>
                  <p className="text-xs text-muted-foreground">Total de horários marcados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Novos Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.daily.newCustomers}</div>
                  <p className="text-xs text-muted-foreground">Cadastrados hoje</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ticket Médio (Mês)</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {stats.monthly.appointments > 0 ? (stats.monthly.totalServicesValue / stats.monthly.appointments).toFixed(2) : "0.00"}
                  </div>
                  <p className="text-xs text-muted-foreground">Baseado no mês atual</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  {isSameDay(selectedDate, new Date()) ? "Agendamentos de Hoje" : `Agendamentos de ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`}
                </CardTitle>
                <CardDescription>
                  {isSameDay(selectedDate, new Date()) 
                    ? "Consulte os detalhes dos horários marcados para hoje." 
                    : `Consulte os detalhes dos horários marcados para o dia ${format(selectedDate, "dd/MM/yyyy")}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {todayAppointments.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhum agendamento para hoje.
                    </div>
                  ) : (
                    todayAppointments.map((app) => (
                      <div 
                        key={app.id} 
                        className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => navigate({ to: "/calendar" })}>
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden">
                            {app.customers?.avatar_url ? (
                              <img 
                                src={app.customers.avatar_url} 
                                alt={app.customers.name} 
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              app.customers?.name?.[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold">{app.customers?.name}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(app.start_time), 'HH:mm')}</span>
                              <span className="flex items-center gap-1"><Scissors size={12} /> {app.services?.name}</span>
                              <span className="flex items-center gap-1"><UserIcon size={12} /> {app.barbers?.name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {app.refund_requested_at && app.refund_status === 'pending' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 text-white bg-amber-500/80 hover:bg-amber-500 text-[10px] gap-1"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const type = app.refund_type === 'refund' ? 'estorno' : 'créditos';
                                  if (confirm(`Confirmar ${type} para este cliente?`)) {
                                    try {
                                      if (app.refund_type === 'credits') {
                                        let { data: wallet } = await supabase
                                          .from("wallet")
                                          .select("id")
                                          .eq("customer_id", app.customer_id)
                                          .maybeSingle();
                                          
                                        if (!wallet) {
                                          const { data: newWallet } = await supabase
                                            .from("wallet")
                                            .insert({ 
                                              customer_id: app.customer_id, 
                                              user_id: user?.id || "",
                                              balance: 0 
                                            })
                                            .select()
                                            .single();
                                          wallet = newWallet;
                                        }

                                        if (wallet) {
                                          await supabase.from("wallet_transactions").insert({
                                            wallet_id: wallet.id,
                                            amount: app.total_price,
                                            type: "credit",
                                            description: `Crédito por cancelamento: ${app.services?.name}`,
                                            appointment_id: app.id,
                                            user_id: user?.id || ""
                                          });
                                          // Remove original income from transactions when converting to credits
                                          await supabase.from("transactions").delete().eq("appointment_id", app.id);
                                          await supabase.from("appointments").delete().eq("id", app.id);
                                          toast.success("Valor convertido em créditos e removido do saldo!");
                                        }
                                      } else if (app.refund_type === 'refund') {
                                        await supabase.from("transactions").insert({
                                          user_id: user.id,
                                          barber_id: app.barber_id,
                                          appointment_id: app.id,
                                          type: "expense",
                                          category: "Estorno",
                                          amount: app.total_price,
                                          description: `Estorno de Pagamento: ${app.services?.name} - Cliente: ${app.customers?.name}`,
                                          date: format(new Date(), "yyyy-MM-dd")
                                        });

                                        await supabase
                                          .from("appointments")
                                          .delete()
                                          .eq("id", app.id);
                                        
                                        toast.success("Estorno registrado como saída!");
                                      }
                                      
                                      fetchTodayAppointments();
                                      fetchStats();
                                    } catch (err) {
                                      toast.error("Erro ao processar solicitação");
                                    }
                                  }
                                }}
                              >
                                <RefreshCcw size={14} />
                                <span>Aprovar {app.refund_type === 'refund' ? 'Estorno' : 'Créditos'}</span>
                              </Button>
                            )}
                            {app.status === 'scheduled' && (
                              <Button 
                                variant="default"
                                size="sm" 
                                className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeAppointment(app);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Concluir
                              </Button>
                            )}
                            {app.status === 'scheduled' && (
                              <Button 
                                variant="outline"
                                size="sm" 
                                className="h-8 gap-1 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("Deseja excluir permanentemente este agendamento?")) {
                                    const { error } = await supabase.from("appointments").delete().eq("id", app.id);
                                    if (error) {
                                      toast.error("Erro ao excluir agendamento");
                                    } else {
                                      fetchTodayAppointments();
                                      fetchStats();
                                      toast.success("Agendamento excluído com sucesso");
                                    }
                                  }
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                                Excluir
                              </Button>
                            )}
                            <Button 
                              variant={app.payment_status === 'paid' ? 'secondary' : 'outline'} 
                              size="sm" 
                              className={cn(
                                "h-8 gap-1 text-xs",
                                app.payment_status === 'paid' && "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePaymentStatus(app);
                              }}
                            >
                              <Check size={14} />
                              {app.payment_status === 'paid' ? 'Pago' : 'Marcar Pago'}
                            </Button>
                            <Badge className={cn(
                              app.status === 'scheduled' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' : 
                              app.status === 'completed' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 
                              'bg-destructive text-destructive-foreground'
                            )} variant="outline">
                              {app.status === 'scheduled' ? 'Agendado' : app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Serviços Vendidos (Mês)</CardTitle>
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ {stats.monthly.totalServicesValue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Valor total dos serviços no mês</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700">Entrada Real (Mês)</CardTitle>
                  <CircleDollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">R$ {stats.monthly.realCashInflow.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Dinheiro novo em caixa no mês</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700">Créditos Usados (Mês)</CardTitle>
                  <Wallet className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700">R$ {stats.monthly.creditsUsed.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Abatido via créditos no mês</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Agendamentos no Mês</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.monthly.appointments}</div>
                  <p className="text-xs text-muted-foreground">Total de atendimentos marcados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Novos Clientes (Mês)</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.monthly.newCustomers}</div>
                  <p className="text-xs text-muted-foreground">Conquistados neste mês</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total.customers}</div>
                  <p className="text-xs text-muted-foreground">Base de dados completa</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button variant="outline" onClick={() => navigate({ to: "/customers" })} className="gap-2">
                <Users size={18} /> Novo Cliente
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/barbers" })} className="gap-2">
                <Target size={18} /> Ver Equipe
              </Button>
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Status da Operação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp size={20} />
                <span className="font-medium">Sistema Online</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Sua barbearia possui {stats.total.services} serviços ativos cadastrados.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Equipe</CardTitle>
              <CardDescription>Profissionais e suas categorias</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/barbers">Ver Todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {barbers.map((barber) => (
                <div key={barber.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {barber.avatar_url ? (
                      <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-primary font-bold text-xs">{barber.name.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{barber.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        barber.category === 'Freelancer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {barber.category}
                      </span>
                      {barber.category === 'Freelancer' && (
                        <span className="text-[10px] text-muted-foreground italic">
                          {barber.commission_rate}% comissão
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {barbers.length === 0 && (
                <p className="col-span-full text-center text-sm text-muted-foreground py-4">
                  Nenhum profissional cadastrado.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
