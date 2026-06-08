import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
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
  Globe,
  ExternalLink,
  Copy,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Bell,
  User as UserIcon,
  RefreshCcw,
  Maximize2,
  Minimize2,
  Gift,
  Eye,
  StopCircle,
  Rocket,
  AlertCircle
} from "lucide-react";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
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
import { TenantCharts } from "@/components/dashboard/TenantCharts";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";


export const Route = createFileRoute("/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { user, profile: authProfile, role, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { plan, usage, limits, trialDaysRemaining, isTrial, isExpired, subscription, refresh: refreshLimits, loading: planLoading } = usePlanLimits();
  const isSubscribed = ['active', 'trialing', 'past_due'].includes(subscription?.status || '');
  const hasActiveSubscription = isSubscribed || subscription?.status === 'active';
  const loading = authLoading || tenantLoading || planLoading;
  const { updateStatus: centralUpdateStatus } = useAppointmentStatus();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    daily: {
      appointments: 0,
      totalServicesValue: 0,
      realCashInflow: 0,
      creditsUsed: 0,
      cashbackUsed: 0,
      cashbackEarned: 0,
      newCustomers: 0
    },
    monthly: {
      appointments: 0,
      totalServicesValue: 0,
      realCashInflow: 0,
      creditsUsed: 0,
      cashbackUsed: 0,
      cashbackEarned: 0,
      newCustomers: 0
    },
    total: {
      customers: 0,
      services: 0,
      customerCredits: 0,
      customerCashback: 0
    }
  });
  const [barbers, setBarbers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [birthdayCustomers, setBirthdayCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    // Se for super_admin e não estiver personificando, redirecionar para o admin dashboard
    if (role === 'super_admin') {
      const impersonatedId = typeof window !== 'undefined' ? sessionStorage.getItem("impersonated_tenant_id") : null;
      if (!impersonatedId) {
        console.log("Dashboard: Redirecting super_admin to admin portal");
        navigate({ to: "/admin/dashboard" });
        return;
      }
    }

    // Se for tenant_admin sem tenantId resolvido, temos um problema de dados
    if (role === 'tenant_admin' && !tenantId) {
      console.warn("Dashboard: tenant_admin without tenantId");
      // toast.error("Erro ao carregar dados da barbearia.");
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (tenantId) {
      fetchStats();
      fetchNotifications();
      fetchTodayAppointments();
      fetchBirthdayCustomers();

      const tables = [
        { name: 'appointments', filter: `tenant_id=eq.${tenantId}` },
        { name: 'transactions', filter: `tenant_id=eq.${tenantId}` },
        { name: 'notifications', filter: `tenant_id=eq.${tenantId}` },
        { name: 'customers', filter: `tenant_id=eq.${tenantId}` },
        { name: 'cashback_transactions', filter: `tenant_id=eq.${tenantId}` },
        { name: 'credit_transactions', filter: `tenant_id=eq.${tenantId}` },
        { name: 'subscriptions', filter: `user_id=eq.${tenantId}` }
      ];
      const channels: any[] = [];

      tables.forEach(table => {
        const channel = supabase
          .channel(`dashboard-realtime-${table.name}-${tenantId}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: table.name, 
            filter: table.filter
          }, (payload: any) => {
            console.log(`REALTIME ${table.name.toUpperCase()} CHANGE`, payload);
            
            fetchTodayAppointments();
            fetchStats();
            refreshLimits();
            
            const queryKeys = [
              ['appointments'], ['calendar'], ['dashboard'], ['customerAppointments'],
              ['calendar-appointments'], ['dashboard-appointments'], ['admin-stats'],
              ['admin-dashboard'], ['credits'], ['finances'], ['financial-dashboard'],
              ['customers'], ['notifications'], ['cashback']
            ];

            queryKeys.forEach(key => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          })
          .subscribe();
        channels.push(channel);
      });

      return () => {
        channels.forEach(channel => supabase.removeChannel(channel));
      };
    }
  }, [tenantId, statusFilter, selectedDate]);

  async function fetchNotifications() {
    if (!tenantId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setNotifications(data);
  }

  async function fetchBirthdayCustomers() {
    if (!tenantId) return;
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const todayDay = today.getDate();
    
    console.log("Fetching birthdays for tenant:", tenantId, "Month:", currentMonth);

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, birth_date, avatar_url")
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("Error fetching birthdays:", error);
      return;
    }

    if (data) {
      console.log("Total customers for tenant:", data.length);
      const currentMonthBirthdays = data.filter(c => {
        if (!c.birth_date) return false;
        
        let month = 0;
        let day = 0;
        
        if (c.birth_date.includes('-')) {
          const parts = c.birth_date.split('-');
          if (parts.length === 3) {
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
          } else if (parts.length === 2) {
            month = parseInt(parts[0]);
            day = parseInt(parts[1]);
          }
        } else if (c.birth_date.includes('/')) {
          const parts = c.birth_date.split('/');
          if (parts.length >= 2) {
            day = parseInt(parts[0]);
            month = parseInt(parts[1]);
          }
        }
        
        if (isNaN(month) || isNaN(day) || month === 0) return false;
        return month === currentMonth && day >= todayDay;
      }).sort((a, b) => {
        const getDayNum = (dateStr: string | null) => {
          if (!dateStr) return 0;
          if (dateStr.includes('-')) return parseInt(dateStr.split('-').reverse()[0]) || 0;
          if (dateStr.includes('/')) return parseInt(dateStr.split('/')[0]) || 0;
          return 0;
        };
        return getDayNum(a.birth_date) - getDayNum(b.birth_date);
      });
      
      console.log("Filtered birthdays this month (today onwards):", currentMonthBirthdays.length);
      setBirthdayCustomers(currentMonthBirthdays);
    }
  }

  async function fetchTodayAppointments() {
    if (!tenantId) return;
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();
    
    console.log('FETCHING APPOINTMENTS FOR:', { tenantId, dayStart, dayEnd });

    let query = supabase
      .from("appointments")
      .select("*, customers(name, phone, loyalty_points, avatar_url, credits), services(name), barbers(name)")
      .eq("tenant_id", tenantId)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd);

    // Filter by status if not 'all'
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    } else {
      // In 'all', we might want to show everything except definitely cancelled ones 
      // OR show them but marked. The original code was using a complex OR.
      // Let's simplify and show all for that day.
    }

    const { data, error } = await query.order("start_time", { ascending: false });
    console.log('DASHBOARD APPOINTMENTS DEBUG:', { tenantId, date: selectedDate, count: data?.length, error });
    if (data) setTodayAppointments(data);
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    fetchNotifications();
  }

  async function completeAppointment(appointment: any) {
    if (appointment.status === 'completed') return;

    // 1. Get available credits and current state
    const { data: customerData } = await supabase
      .from("customers")
      .select("credits, loyalty_points, cashback_balance, name")
      .eq("id", appointment.customer_id)
      .single();

    const availableCredits = Number(customerData?.credits || 0);
    const availableCashback = Number(customerData?.cashback_balance || 0);
    const totalPrice = Number(appointment.original_total || appointment.total_price || 0);
    
    // Determine how much credit and cashback will be used (only if not already subtracted)
    let usedCredits = Number(appointment.credit_used || 0);
    let usedCashback = Number(appointment.cashback_used || 0);
    let remainingToPay = Number(appointment.final_amount || totalPrice);

    // Determine how much credit and cashback will be used if not already set
    if (appointment.payment_status !== 'paid' && usedCredits === 0 && usedCashback === 0 && (remainingToPay === totalPrice || !appointment.final_amount)) {
      if (availableCashback > 0) {
        usedCashback = Math.min(availableCashback, remainingToPay);
        remainingToPay -= usedCashback;
      }
      if (remainingToPay > 0 && availableCredits > 0) {
        usedCredits = Math.min(availableCredits, remainingToPay);
        remainingToPay -= usedCredits;
      }
    }

    // 2. Update status using CENTRALIZED RPC hook
    // The RPC handled in useAppointmentStatus (complete_appointment) 
    // now correctly handles financial registration and deductions.
    const result = await centralUpdateStatus(
      appointment.id,
      'completed',
      {
        payment_status: 'paid',
        credit_used: usedCredits,
        cashback_used: usedCashback,
        final_amount: remainingToPay
      },
      'dashboard'
    );

    if (!result.success) return;

    // 3. Finance is now handled inside complete_appointment RPC
    fetchTodayAppointments();
    fetchStats();
    refreshLimits();
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  async function togglePaymentStatus(appointment: any) {
    const newStatus = appointment.payment_status === 'paid' ? 'pending' : 'paid';
    
    // If marking as paid, and appointment is already completed, ensure it exists in transactions
    if (newStatus === 'paid' && appointment.status === 'completed') {
      const remainingToPay = Number(appointment.final_amount || appointment.total_price || 0);
      const usedCredits = Number(appointment.credit_used || 0);
      
      // Criar transação mesmo que seja 0 para constar no financeiro
      const creditText = usedCredits > 0 ? ` (Créditos: R$ ${usedCredits.toFixed(2)})` : "";
      
      if (!tenantId) {
        toast.error("Tenant não identificado");
        return;
      }

      const { error: transError } = await supabase
        .from("transactions")
        .insert([{
          amount: remainingToPay,
          type: "income",
          description: `Atendimento${creditText}: ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'}`,
          category: "Serviço",
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          tenant_id: tenantId,
          user_id: tenantId,
          date: new Date().toISOString().split('T')[0]
        }]);
      
      if (transError) console.error("Error creating transaction on payment status toggle:", transError);
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

    // Em vez de deletar, atualizamos o status para cancelado
    const { error } = await supabase
      .from("appointments")
      .update({ status: 'cancelled' })
      .eq("id", appointmentId);

    if (error) {
      toast.error("Erro ao cancelar agendamento");
      return;
    }

    // Se o agendamento foi pago via Pix e o cliente solicitou reembolso/crédito
    if (appointment.payment_status === 'paid') {
      const totalPrice = Number(appointment.total_price || 0);
      
      if (!tenantId) {
        toast.error("Tenant não identificado");
        return;
      }

      if (appointment.refund_type === 'refund') {
        // Estorno: Remove da receita (cria uma saída/despesa para abater)
        await supabase.from("transactions").insert([{
          amount: totalPrice,
          type: "expense",
          description: `Estorno (Cancelamento Pix): ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'}`,
          category: "Estorno",
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          tenant_id: tenantId,
          user_id: tenantId,
          date: new Date().toISOString().split('T')[0]
        }]);
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
                user_id: tenantId,
                balance: 0 
              })
              .select()
              .single();
            if (walletErr) throw walletErr;
            wallet = newWallet;
          }
          // @ts-ignore

          // 2. Adicionar crédito à carteira
          await supabase.from("wallet_transactions").insert([{
            wallet_id: wallet.id,
            amount: totalPrice,
            type: "credit",
            description: `Crédito por cancelamento: ${appointment.services?.name || 'Serviço'}`,
            appointment_id: appointment.id,
            user_id: tenantId
          }]);

          // 3. Registrar na transação como 0 para não contar como receita nova nem saída, 
          // mas documentar o movimento. O valor original de 'income' continua lá, 
          // mas agora o cliente tem o crédito para usar.
          // Usando valor total original para o crédito
          await supabase.from("transactions").insert([{
            amount: 0,
            type: "income",
            description: `Crédito Gerado: ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'} (R$ ${totalPrice.toFixed(2)})`,
            category: "Crédito Cliente",
            barber_id: appointment.barber_id,
            appointment_id: appointment.id,
            tenant_id: tenantId,
            user_id: tenantId,
            date: new Date().toISOString().split('T')[0]
          }]);

          toast.success("Agendamento cancelado e valor convertido em créditos!");
        } catch (err) {
          console.error("Erro ao gerar créditos:", err);
          toast.error("Erro ao converter valor em créditos.");
        // @ts-ignore
        }
      } else {
        // Fallback: se não tiver tipo de reembolso definido, registra como despesa (estorno padrão)
        await supabase.from("transactions").insert([{
          amount: totalPrice,
          type: "expense",
          description: `Cancelamento: ${appointment.services?.name || 'Serviço'} - ${appointment.customers?.name || 'Cliente'}`,
          category: "Cancelamento",
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          tenant_id: tenantId,
          user_id: tenantId,
          date: new Date().toISOString().split('T')[0]
        }]);
        toast.success("Agendamento cancelado!");
      }
    } else {
      toast.success("Agendamento cancelado!");
    }

    fetchTodayAppointments();
    fetchStats();
  }

  async function fetchStats() {
    if (!user || !tenantId) return;
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
      monthlyAppointmentsData,
      customersWithBalances
    ] = await Promise.all([
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).not("status", "eq", "cancelled").gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).not("status", "eq", "cancelled").gte("start_time", monthStart).lte("start_time", monthEnd),
      // Buscar todas as transações para filtrar em memória
      supabase.from("transactions").select("amount, type, appointment:appointments(status, payment_method)").eq("tenant_id", tenantId).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("transactions").select("amount, type, appointment:appointments(status, payment_method)").eq("tenant_id", tenantId).gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("services").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("barbers").select("*").eq("tenant_id", tenantId).eq("active", true).limit(5),
      supabase.from("profiles").select("*").eq("id", tenantId).single(),
      supabase.from("wallet").select("balance").eq("user_id", tenantId),
      // Valor dos serviços: APENAS CONCLUÍDOS
      supabase.from("appointments").select("total_price, original_total, credit_used, cashback_used, cashback_earned, final_amount, payment_method")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("total_price, original_total, credit_used, cashback_used, cashback_earned, final_amount, payment_method")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("customers").select("credits, cashback_balance").eq("tenant_id", tenantId)
    ]);

    const totalCredits = customersWithBalances.data?.reduce((acc, curr) => acc + Number(curr.credits || 0), 0) || 0;
    const totalCashback = customersWithBalances.data?.reduce((acc, curr) => acc + Number(curr.cashback_balance || 0), 0) || 0;

    setBarbers(barbersData.data || []);
    setProfile(profileData.data);

    // Função auxiliar para calcular entrada real desconsiderando agendamentos cancelados e pagamentos via saldo
    const calculateCashInflow = (transData: any[] | null) => {
      return transData?.reduce((acc, curr: any) => {
        if (curr.type === 'income') {
          // Ignorar se vinculado a agendamento cancelado
          if (curr.appointment && curr.appointment.status === 'cancelled') {
            return acc;
          }
          
          // Ignorar transações de créditos/cashback que não representam dinheiro novo real em caixa (PIX/Dinheiro/Cartão)
          // Se o método de pagamento for explicitamente cashback ou créditos, ignoramos o amount no caixa real
          if (curr.appointment && (curr.appointment.payment_method === 'cashback' || curr.appointment.payment_method === 'credits')) {
            return acc;
          }
          
          return acc + Number(curr.amount || 0);
        } else if (curr.type === 'expense') {
            return acc - Number(curr.amount || 0);
        }
        return acc;
      }, 0) || 0;
    };

    // Cálculos Diários
    const dailyServicesValue = dailyAppointmentsData.data?.reduce((acc: number, curr: any) => acc + Number(curr.total_price || curr.original_total || 0), 0) || 0;
    const dailyCreditsUsed = dailyAppointmentsData.data?.reduce((acc: number, curr: any) => {
      let val = (Number(curr.credit_used || 0) + Number(curr.credits_used || 0));
      if (val === 0 && curr.payment_method === 'credits') {
        val = Number(curr.total_price || curr.original_total || 0);
      }
      return acc + val;
    }, 0) || 0;
    const dailyCashbackUsed = dailyAppointmentsData.data?.reduce((acc: number, curr: any) => {
      let val = Number(curr.cashback_used || 0);
      if (val === 0 && curr.payment_method === 'cashback') {
        val = Number(curr.total_price || curr.original_total || 0);
      }
      return acc + val;
    }, 0) || 0;
    const dailyCashbackEarned = dailyAppointmentsData.data?.reduce((acc: number, curr: any) => acc + Number(curr.cashback_earned || 0), 0) || 0;
    const dailyCashInflow = calculateCashInflow(dailyTrans.data);

    // Cálculos Mensais
    const monthlyServicesValue = monthlyAppointmentsData.data?.reduce((acc: number, curr: any) => acc + Number(curr.total_price || curr.original_total || 0), 0) || 0;
    const monthlyCreditsUsed = monthlyAppointmentsData.data?.reduce((acc: number, curr: any) => {
      let val = (Number(curr.credit_used || 0) + Number(curr.credits_used || 0));
      if (val === 0 && curr.payment_method === 'credits') {
        val = Number(curr.total_price || curr.original_total || 0);
      }
      return acc + val;
    }, 0) || 0;
    const monthlyCashbackUsed = monthlyAppointmentsData.data?.reduce((acc: number, curr: any) => {
      let val = Number(curr.cashback_used || 0);
      if (val === 0 && curr.payment_method === 'cashback') {
        val = Number(curr.total_price || curr.original_total || 0);
      }
      return acc + val;
    }, 0) || 0;
    const monthlyCashbackEarned = monthlyAppointmentsData.data?.reduce((acc: number, curr: any) => acc + Number(curr.cashback_earned || 0), 0) || 0;
    const monthlyCashInflow = calculateCashInflow(monthlyTrans.data);

    setStats({
      daily: {
        appointments: dailyApp.count || 0,
        totalServicesValue: dailyServicesValue,
        realCashInflow: dailyCashInflow,
        creditsUsed: dailyCreditsUsed,
        cashbackUsed: dailyCashbackUsed,
        cashbackEarned: dailyCashbackEarned,
        newCustomers: dailyCust.count || 0
      },
      monthly: {
        appointments: monthlyApp.count || 0,
        totalServicesValue: monthlyServicesValue,
        realCashInflow: monthlyCashInflow,
        creditsUsed: monthlyCreditsUsed,
        cashbackUsed: monthlyCashbackUsed,
        cashbackEarned: monthlyCashbackEarned,
        newCustomers: monthlyCust.count || 0
      },
      total: {
        customers: totalCust.count || 0,
        services: totalServ.count || 0,
        customerCredits: totalCredits,
        customerCashback: totalCashback
      }
    });

    console.log('TENANT CARD DATA', {
      tenantId,
      plan: (profileData.data as any)?.plan || 'free',
      appointmentsCount: monthlyApp.count || 0,
      professionalsCount: barbersData.data?.length || 0,
      servicesCount: totalServ.count || 0,
      whatsappCount: 0, // Need to fetch this too if needed, but it's in usePlanLimits
      totalCredits,
      totalCashback
    });
  }

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile?.logo_url ? (
              <img 
                src={profile.logo_url} 
                alt={profile.business_name} 
                className="h-16 w-16 rounded-full object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20">
                <UserIcon size={32} />
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {profile?.business_name ? `Olá, ${profile.business_name}!` : "Painel de Controle"}
              </h2>
              <p className="text-muted-foreground">Bem-vindo de volta ao seu painel administrativo.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AppointmentModal 
              onSuccess={() => {
                fetchTodayAppointments();
                fetchStats();
              }}
              trigger={
                <Button className="gap-2 bg-white text-black hover:bg-white/90 border border-input shadow-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95">
                  <Calendar size={18} /> Novo Agendamento
                </Button>
              }
            />
          </div>
        </div>
        
        {/* Banner de Trial / Assinatura */}
        {((isTrial || isExpired) && !hasActiveSubscription) && (
          <div className={cn(
            "relative overflow-hidden rounded-[2rem] p-6 mb-6 shadow-2xl transition-all duration-500 group",
            isExpired ? "bg-white border-2 border-red-500/50 shadow-red-500/10" : 
            "bg-white border-2 border-amber-500/50 shadow-amber-500/10"
          )}>
            {/* Glow Effect */}
            <div className={cn(
              "absolute -top-24 -right-24 w-64 h-64 blur-[100px] opacity-10 rounded-full",
              isExpired ? "bg-red-500" : "bg-amber-500"
            )} />
            
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "p-4 rounded-2xl shadow-inner flex items-center justify-center",
                  isExpired ? "bg-red-500/10 text-red-600" : "bg-amber-100 text-amber-600"
                )}>
                  {isExpired ? <AlertCircle className="w-8 h-8" /> : <Crown className="w-8 h-8 animate-pulse" />}
                </div>
                <div className="space-y-1">
                  <h3 className={cn(
                    "text-xl font-black italic tracking-tight flex items-center gap-2",
                    isExpired ? "text-red-900" : "text-amber-900"
                  )}>
                    {isExpired ? "PERÍODO DE TESTE EXPIRADO" : "STATUS DA ASSINATURA SAAS"}
                  </h3>
                  <p className="text-muted-foreground font-medium max-w-md">
                    {isExpired 
                      ? "Seu período de avaliação gratuita terminou. Assine agora para continuar usando todos os recursos." 
                      : `Você está usando o período de teste gratuito. Restam ${trialDaysRemaining} dias.`}
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => navigate({ to: "/subscription" })}
                className={cn(
                  "px-8 h-12 rounded-2xl font-black italic transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl",
                  isExpired ? "bg-red-600 hover:bg-red-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"
                )}
              >
                {isExpired ? "ASSINAR AGORA" : "FAZER UPGRADE"}
              </Button>
            </div>
          </div>
        )}


        {profile?.slug && (
          <Card className="bg-primary/5 border-primary/20 overflow-hidden mb-6">
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

        {birthdayCustomers.length > 0 && (
          <Card className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/20 mb-6">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-500/20 rounded-lg text-pink-600">
                  <Gift size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pink-700">Aniversariantes do Mês! 🎂</h3>
                  <p className="text-xs text-muted-foreground">
                    {birthdayCustomers.length} cliente{birthdayCustomers.length > 1 ? 's fazem' : ' faz'} aniversário este mês.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2 overflow-hidden">
                  {birthdayCustomers.slice(0, 5).map((customer, i) => (
                    <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-pink-100 flex items-center justify-center text-[10px] font-bold text-pink-700 overflow-hidden">
                      {customer.avatar_url ? (
                        <img src={customer.avatar_url} alt={customer.name} className="h-full w-full object-cover" />
                      ) : (
                        customer.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                  ))}
                  {birthdayCustomers.length > 5 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                      +{birthdayCustomers.length - 5}
                    </div>
                  )}
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-pink-700 hover:text-pink-800 hover:bg-pink-500/10 gap-1 font-bold whitespace-nowrap"
                  onClick={() => navigate({ to: "/customers" })}
                >
                  Ver Lista <ArrowUpRight size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 mb-6">
          <Card className="lg:col-span-4 bg-card border-2 border-amber-500/20 shadow-lg shadow-amber-500/5 relative overflow-hidden group">
            {/* Glow sutil no fundo */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-amber-500/20 transition-all duration-500" />
            
            <CardHeader className="pb-2 relative">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <CardTitle className="text-xl font-black italic tracking-tight text-amber-600 dark:text-amber-500">
                      Plano {plan === 'free' ? 'Teste Grátis' : plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                      <Crown className="w-3 h-3 text-amber-600" />
                      <span className="text-[10px] font-black italic text-amber-700 dark:text-amber-400 tracking-tight uppercase">
                        Status da Assinatura SaaS
                      </span>
                    </div>
                    {isSubscribed ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 font-black italic text-[10px] tracking-widest uppercase">
                        Assinatura Ativa
                      </Badge>
                    ) : isTrial ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-black italic text-[10px] tracking-widest uppercase">
                        Trial Ativo
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-700 border-red-500/20 font-black italic text-[10px] tracking-widest uppercase">
                        Expirado
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="font-bold text-muted-foreground text-[11px] tracking-wide uppercase italic">
                    Gerencie os recursos e limites da sua barbearia
                  </CardDescription>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center border border-amber-100 dark:border-amber-800/30">
                  {plan === 'elite' ? <Rocket className="w-5 h-5 text-amber-600 animate-bounce-slow" /> : 
                   plan === 'pro' ? <Crown className="w-5 h-5 text-amber-500" /> : 
                   <Zap className="w-5 h-5 text-amber-500" />}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500 italic">Profissionais</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-black leading-none text-foreground">{usage.barbers}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">/ {limits.barbers === Infinity ? "∞" : limits.barbers}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000 ease-out" 
                      style={{ width: `${limits.barbers === Infinity ? 100 : Math.min((usage.barbers / limits.barbers) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500 italic">Serviços</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-black leading-none text-foreground">{usage.services}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">/ {limits.services === Infinity ? "∞" : limits.services}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000 ease-out" 
                      style={{ width: `${limits.services === Infinity ? 100 : Math.min((usage.services / limits.services) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500 italic">Agendamentos</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-black leading-none text-foreground">{usage.monthlyAppointments}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">/ {limits.monthlyAppointments === Infinity ? "∞" : limits.monthlyAppointments}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000 ease-out" 
                      style={{ width: `${limits.monthlyAppointments === Infinity ? 100 : Math.min((usage.monthlyAppointments / limits.monthlyAppointments) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1 bg-sky-500/5 p-3 rounded-2xl border border-sky-500/10">
                  <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-500">WhatsApp</span>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-black leading-none text-foreground">{usage.whatsappConnections}</span>
                    <span className="text-[10px] text-muted-foreground">/ {limits.whatsappConnections === Infinity ? "∞" : limits.whatsappConnections}</span>
                  </div>
                  <Progress value={limits.whatsappConnections === Infinity ? 100 : (usage.whatsappConnections / limits.whatsappConnections) * 100} className="h-1 bg-sky-100" />
                </div>
                <div className="space-y-1 bg-purple-500/5 p-3 rounded-2xl border border-purple-500/10">
                  <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400">Créditos</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-black leading-none text-purple-800 dark:text-purple-200">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.total.customerCredits)}
                    </span>
                  </div>
                  <div className="p-1 bg-purple-100 dark:bg-purple-900/40 rounded-lg text-purple-700 dark:text-purple-300 w-fit">
                    <Wallet size={12} />
                  </div>
                </div>
                <div className="space-y-1 bg-orange-500/5 p-3 rounded-2xl border border-orange-500/10">
                  <span className="text-[10px] uppercase font-bold text-orange-700 dark:text-orange-400">Cashback</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-black leading-none text-orange-800 dark:text-orange-200">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.total.customerCashback)}
                    </span>
                  </div>
                  <div className="p-1 bg-orange-100 dark:bg-orange-900/40 rounded-lg text-orange-700 dark:text-orange-300 w-fit">
                    <Gift size={12} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn(
            "lg:col-span-3 flex flex-col justify-center overflow-hidden border-2 relative group bg-card",
            !isExpired 
              ? "border-emerald-500/30 shadow-2xl shadow-emerald-500/10"
              : "border-red-500/30 shadow-2xl shadow-red-500/10"
          )}>
            <div className={cn(
              "absolute -bottom-12 -left-12 w-32 h-32 blur-[50px] rounded-full pointer-events-none group-hover:opacity-100 transition-all duration-500",
              !isExpired ? "bg-emerald-500/10 opacity-60" : "bg-red-500/10 opacity-60"
            )} />
            
            <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Crown className={cn("w-12 h-12 rotate-12", !isExpired ? "text-emerald-500" : "text-red-500")} />
            </div>

            <CardContent className="py-6 space-y-6 relative z-10">
              <div className="flex justify-center mb-2">
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm",
                  !isExpired ? "bg-emerald-500/10 border border-emerald-500/20 shadow-emerald-500/5" : "bg-red-500/10 border border-red-500/20 shadow-red-500/5"
                )}>
                  <Crown className={cn("w-3 h-3", !isExpired ? "text-emerald-600" : "text-red-600")} />
                  <span className={cn("text-[10px] font-black italic tracking-tight uppercase", !isExpired ? "text-emerald-700" : "text-red-700")}>
                    Status da Assinatura SaaS
                  </span>
                </div>
              </div>

              {/* Plan & Status */}
              <div className="flex justify-between items-center bg-muted/50 p-4 rounded-2xl border border-border">
                <div>
                  <h4 className="text-[10px] font-bold uppercase italic text-muted-foreground">Plano Atual</h4>
                  <p className="text-lg font-black uppercase italic text-foreground">
                    {plan === 'free' ? 'Teste Grátis' : plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </p>
                </div>
                <Badge className={cn(
                  "text-[10px] font-black italic tracking-widest uppercase px-3 py-1 border-none",
                  isExpired ? "bg-red-500 text-white" : isTrial ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                )}>
                  {isExpired ? "EXPIRADA" : isTrial ? "TRIAL" : "ATIVA"}
                </Badge>
              </div>

              {/* Limits */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase italic text-muted-foreground">Uso do Plano</h4>
                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-foreground">
                    <span className="flex items-center gap-2"><Users size={14} className="text-primary" /> Profissionais</span>
                    <span className="font-bold">{usage.barbers} / {limits.barbers === Infinity ? '∞' : limits.barbers}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-foreground">
                    <span className="flex items-center gap-2"><Scissors size={14} className="text-primary" /> Serviços</span>
                    <span className="font-bold">{usage.services} / {limits.services === Infinity ? '∞' : limits.services}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-foreground">
                    <span className="flex items-center gap-2"><Calendar size={14} className="text-primary" /> Agendamentos (Mês)</span>
                    <span className="font-bold">{usage.monthlyAppointments} / {limits.monthlyAppointments === Infinity ? '∞' : limits.monthlyAppointments}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-foreground">
                    <span className="flex items-center gap-2"><Zap size={14} className="text-primary" /> Conexões WhatsApp</span>
                    <span className="font-bold">{usage.whatsappConnections} / {limits.whatsappConnections === Infinity ? '∞' : limits.whatsappConnections}</span>
                  </div>
                </div>
              </div>

              {/* Financial Tenant Stats */}
              <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 bg-purple-500/5 p-3 rounded-2xl border border-purple-500/10">
                  <h4 className="text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">Créditos Clientes</h4>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg shrink-0">
                      <Wallet className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                    </div>
                    <span className="text-base font-black text-purple-900 dark:text-purple-100 truncate">
                      R$ {stats.total.customerCredits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 bg-orange-500/5 p-3 rounded-2xl border border-orange-500/10">
                  <h4 className="text-[10px] font-bold uppercase text-orange-800 dark:text-orange-300">Cashback Total</h4>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-100 dark:bg-orange-900/40 rounded-lg shrink-0">
                      <Gift className="w-3.5 h-3.5 text-orange-700 dark:text-orange-400" />
                    </div>
                    <span className="text-base font-black text-orange-900 dark:text-orange-100 truncate">
                      R$ {stats.total.customerCashback.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <Button 
                variant="outline" 
                className={cn(
                  "w-full mt-2 font-black italic uppercase tracking-wider h-11 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-sm",
                  !isExpired ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30" : "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                )} 
                asChild
              >
                <Link to="/subscription">Gerenciar Assinatura</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="daily" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            <TabsList className="flex w-max min-w-full md:grid md:grid-cols-3 md:w-full max-w-[500px]">
              <TabsTrigger value="daily">Hoje</TabsTrigger>
              <TabsTrigger value="monthly">Este Mês</TabsTrigger>
              <TabsTrigger value="analytics">Gráficos</TabsTrigger>
            </TabsList>
          </div>


          <TabsContent value="daily" className="space-y-6">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-semibold shrink-0">
                  {isSameDay(selectedDate, new Date()) ? "Agendamentos de Hoje" : `Agendamentos de ${format(selectedDate, "dd/MM")}`}
                </h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
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
              
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-1 px-1">
                <Button 
                  variant={statusFilter === "all" ? "default" : "outline"} 
                  size="sm"
                  className="flex-shrink-0 w-auto"
                  onClick={() => setStatusFilter("all")}
                >
                  Todos
                </Button>
                <Button 
                  variant={statusFilter === "scheduled" ? "default" : "outline"} 
                  size="sm"
                  className="flex-shrink-0 w-auto"
                  onClick={() => setStatusFilter("scheduled")}
                >
                  Agendados
                </Button>
                <Button 
                  variant={statusFilter === "completed" ? "default" : "outline"} 
                  size="sm"
                  className="flex-shrink-0 w-auto"
                  onClick={() => setStatusFilter("completed")}
                >
                  Concluídos
                </Button>
                <Button 
                  variant={statusFilter === "cancelled" ? "default" : "outline"} 
                  size="sm"
                  className="flex-shrink-0 w-auto"
                  onClick={() => setStatusFilter("cancelled")}
                >
                  Cancelados
                </Button>
              </div>
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
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 text-xs font-bold border-zinc-200 hover:bg-zinc-50 rounded-xl"
                      onClick={() => fetchTodayAppointments()}
                    >
                      <RefreshCcw size={14} className={cn("text-sky-500", loading && "animate-spin")} />
                      Recalcular Dashboard
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                  {todayAppointments.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhum agendamento para hoje.
                    </div>
                  ) : (
                    todayAppointments.map((app) => (
                      <div 
                        key={app.id} 
                        className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors group gap-4"
                      >
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate({ to: "/calendar" })}>
                          <div className="h-12 w-12 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
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
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{app.customers?.name}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock size={12} className="shrink-0" /> {format(new Date(app.start_time), 'HH:mm')}</span>
                              <span className="flex items-center gap-1"><Scissors size={12} className="shrink-0" /> {app.services?.name}</span>
                              <span className="flex items-center gap-1"><UserIcon size={12} className="shrink-0" /> {app.barbers?.name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                             {app.refund_requested_at && (
                               app.refund_status === 'pending' ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 text-white bg-amber-500/80 hover:bg-amber-500 text-[10px] gap-1 w-auto"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const type = app.refund_type === 'refund' ? 'estorno' : 'créditos';
                                  if (confirm(`Confirmar ${type} para este cliente?`)) {
                                      try {
                                        const now = new Date();
                                        const formattedDate = format(now, "yyyy-MM-dd");

                                        // Restore used cashback/credits and remove earned cashback
                                        const { data: currentCustomer } = await supabase
                                          .from("customers")
                                          .select("credits, cashback_balance")
                                          .eq("id", app.customer_id)
                                          .single();

                                        const restoredCredits = (currentCustomer?.credits || 0) + (app.credit_used || 0);
                                        const restoredCashback = (currentCustomer?.cashback_balance || 0) + (app.cashback_used || 0) - (app.cashback_earned || 0);

                                        await supabase
                                          .from("customers")
                                          .update({ 
                                            credits: restoredCredits,
                                            cashback_balance: Math.max(0, restoredCashback)
                                          })
                                          .eq("id", app.customer_id);

                                        if (app.refund_type === 'credits') {
                                          let { data: wallet } = await supabase
                                            .from("wallet")
                                            .select("id")
                                            .eq("customer_id", app.customer_id)
                                            .maybeSingle();
                                            
                                          if (!wallet && tenantId) {
                                            const { data: newWallet } = await supabase
                                              .from("wallet")
                                              .insert({ 
                                                customer_id: app.customer_id, 
                                                user_id: tenantId,
                                                balance: 0 
                                              })
                                              .select()
                                              .single();
                                            wallet = newWallet;
                                          }

                                          if (wallet && tenantId) {
                                            // The refund amount should be the final_amount (what was paid in new money)
                                            const refundAmount = Number(app.final_amount || 0);

                                            if (refundAmount > 0) {
                                              await supabase.from("wallet_transactions").insert({
                                                wallet_id: wallet.id,
                                                amount: refundAmount,
                                                type: "credit",
                                                description: `Crédito por cancelamento (Estorno Real): ${app.services?.name}`,
                                                appointment_id: app.id,
                                                user_id: tenantId
                                              });

                                              // Update customer credits with the additional refund amount
                                              await supabase.from("customers").update({ credits: restoredCredits + refundAmount }).eq("id", app.customer_id);

                                              // Remove original income from transactions when converting to credits
                                              await supabase.from("transactions").insert({ 
                                                user_id: tenantId, 
                                                barber_id: app.barber_id, 
                                                appointment_id: app.id, 
                                                type: "expense", 
                                                category: "Estorno (Créditos)", 
                                                amount: refundAmount, 
                                                description: `Conversão em Créditos: ${app.services?.name} - Cliente: ${app.customers?.name}`, 
                                                date: formattedDate 
                                              });
                                            }

                                          await supabase.from("appointments").update({ 
                                            status: "cancelled",
                                            refund_status: "completed"
                                          }).eq("id", app.id);

                                          toast.success("Valor convertido em créditos e agendamento cancelado!");
                                        }
                                      } else if (app.refund_type === 'refund' && tenantId) {
                                        const refundAmount = Number(app.final_amount || 0);

                                        if (refundAmount > 0) {
                                          await supabase.from("transactions").insert({
                                            user_id: tenantId,
                                            barber_id: app.barber_id,
                                            appointment_id: app.id,
                                            type: "expense",
                                            category: "Estorno",
                                            amount: refundAmount,
                                            description: `Estorno de Pagamento: ${app.services?.name} - Cliente: ${app.customers?.name}`,
                                            date: formattedDate
                                          });
                                        }

                                        await supabase
                                          .from("appointments")
                                          .update({ 
                                            status: "cancelled",
                                            refund_status: "completed"
                                          })
                                          .eq("id", app.id);
                                        
                                        toast.success("Estorno registrado como saída!");
                                      }
                                      
                                      // Trigger re-fetches for all related data
                                      await Promise.all([
                                        fetchTodayAppointments(),
                                        fetchStats(),
                                        fetchNotifications()
                                      ]);
                                    } catch (err) {
                                      console.error("Erro ao processar estorno:", err);
                                      toast.error("Erro ao processar solicitação");
                                    }
                                  }
                                }}
                              >
                                <RefreshCcw size={14} />
                                <span>Aprovar {app.refund_type === 'refund' ? 'Estorno' : 'Créditos'}</span>
                              </Button>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px]">
                                    {app.refund_type === 'credits' ? 'Créditos' : 'Estorno'} Concluído
                                  </Badge>
                                )
                              )}
                            {app.status === 'scheduled' && (
                              <Button 
                                variant="default"
                                size="sm" 
                                className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700 w-full sm:w-auto"
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
                                className="h-8 gap-1 text-xs text-destructive border-destructive/20 hover:bg-destructive/10 w-full sm:w-auto"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("Deseja cancelar este agendamento?")) {
                                    try {
                                      // Restore used credits and cashback
                                      const { data: customer } = await supabase
                                        .from("customers")
                                        .select("credits, cashback_balance")
                                        .eq("id", app.customer_id)
                                        .single();

                                      if (customer) {
                                        await supabase
                                          .from("customers")
                                          .update({
                                            credits: (customer.credits || 0) + (app.credit_used || 0),
                                            cashback_balance: (customer.cashback_balance || 0) + (app.cashback_used || 0)
                                          })
                                          .eq("id", app.customer_id);
                                      }

                                       const result = await centralUpdateStatus(app.id, 'cancelled', {}, 'dashboard');
                                       if (!result.success) throw result.error;

                                      fetchTodayAppointments();
                                      fetchStats();
                                      toast.success("Agendamento cancelado e saldos restaurados");
                                    } catch (err) {
                                      console.error("Erro ao cancelar:", err);
                                      toast.error("Erro ao cancelar agendamento");
                                    }
                                  }
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                                Cancelar
                              </Button>
                            )}
                                {app.status === 'cancelled' ? (
                                  <Badge variant="destructive" className="text-[10px]">Cancelado</Badge>
                                ) : (
                                  <>
                                    <Button 
                                      variant={app.payment_status === 'paid' ? 'secondary' : 'outline'} 
                                      size="sm" 
                                      className={cn(
                                        "h-8 gap-1 text-xs w-full sm:w-auto",
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
                                      app.status === 'scheduled' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                      app.status === 'completed' ? 'bg-emerald-600 text-white' : 
                                      'bg-destructive text-white'
                                    )} variant="outline">
                                      {app.status === 'scheduled' ? 'Agendado' : app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                                    </Badge>
                                  </>
                                )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-white border-2 border-blue-500/30 shadow-lg shadow-blue-500/5 hover:border-blue-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-900">Serviços Vendidos Hoje</CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Scissors className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-blue-700">R$ {stats.daily.totalServicesValue.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-blue-500/60 mt-1">Valor total dos serviços</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-2 border-green-500/30 shadow-lg shadow-green-500/5 hover:border-green-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-green-900">Entrada em Caixa Hoje</CardTitle>
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CircleDollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-green-700">R$ {stats.daily.realCashInflow.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-green-500/60 mt-1">Dinheiro novo (PIX/Dinheiro)</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-2 border-purple-500/30 shadow-lg shadow-purple-500/5 hover:border-purple-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-purple-900">Créditos Utilizados Hoje</CardTitle>
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Wallet className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-purple-700">R$ {stats.daily.creditsUsed.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-purple-500/60 mt-1">Abatido de saldos anteriores</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 pt-2">
              <Card className="bg-white border-2 border-orange-500/30 shadow-lg shadow-orange-500/5 hover:border-orange-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-orange-900">Cashback Utilizado Hoje</CardTitle>
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <ArrowUpRight className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-orange-700">R$ {stats.daily.cashbackUsed.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-orange-500/60 mt-1">Abatimento via cashback</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-2 border-yellow-500/30 shadow-lg shadow-yellow-500/5 hover:border-yellow-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-yellow-900">Cashback Gerado Hoje</CardTitle>
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <ArrowDownRight className="h-4 w-4 text-yellow-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-yellow-700">R$ {stats.daily.cashbackEarned.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-yellow-500/60 mt-1">Novos saldos de cashback</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
              <Card className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">Agendamentos Hoje</CardTitle>
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Calendar className="h-4 w-4 text-slate-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-slate-900">{stats.daily.appointments}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 mt-1">Total de horários marcados</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">Novos Clientes</CardTitle>
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Users className="h-4 w-4 text-slate-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-slate-900">{stats.daily.newCustomers}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 mt-1">Cadastrados hoje</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">Ticket Médio (Mês)</CardTitle>
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Target className="h-4 w-4 text-slate-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-slate-900">
                    R$ {stats.monthly.appointments > 0 ? (stats.monthly.totalServicesValue / stats.monthly.appointments).toFixed(2) : "0.00"}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 mt-1">Baseado no mês atual</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="p-6 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
               <TenantCharts tenantId={tenantId || ""} />
            </div>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-white border-2 border-blue-500/30 shadow-lg shadow-blue-500/5 hover:border-blue-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-900">Serviços Vendidos (Mês)</CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Scissors className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-blue-700">R$ {stats.monthly.totalServicesValue.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-blue-500/60 mt-1">Valor total no mês</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-green-500/30 shadow-lg shadow-green-500/5 hover:border-green-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-green-900">Entrada Real (Mês)</CardTitle>
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CircleDollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-green-700">R$ {stats.monthly.realCashInflow.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-green-500/60 mt-1">Dinheiro novo em caixa</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-purple-500/30 shadow-lg shadow-purple-500/5 hover:border-purple-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-purple-900">Créditos Usados (Mês)</CardTitle>
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Wallet className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-purple-700">R$ {stats.monthly.creditsUsed.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-purple-500/60 mt-1">Abatido via créditos</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-orange-500/30 shadow-lg shadow-orange-500/5 hover:border-orange-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-orange-900">Cashback Utilizado (Mês)</CardTitle>
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <ArrowUpRight className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-orange-700">R$ {stats.monthly.cashbackUsed.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-orange-500/60 mt-1">Abatimento via cashback</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-yellow-500/30 shadow-lg shadow-yellow-500/5 hover:border-yellow-500/60 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-yellow-900">Cashback Gerado (Mês)</CardTitle>
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <ArrowDownRight className="h-4 w-4 text-yellow-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-yellow-700">R$ {stats.monthly.cashbackEarned.toFixed(2)}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-yellow-500/60 mt-1">Novos saldos gerados</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">Agendamentos (Mês)</CardTitle>
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Calendar className="h-4 w-4 text-slate-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-slate-900">{stats.monthly.appointments}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 mt-1">Total de horários marcados</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">Novos Clientes (Mês)</CardTitle>
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Users className="h-4 w-4 text-slate-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-slate-900">{stats.monthly.newCustomers}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 mt-1">Conquistados este mês</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">Total de Clientes</CardTitle>
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-slate-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-slate-900">{stats.total.customers}</div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 mt-1">Base de dados completa</p>
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
                      <span className="text-primary font-bold text-xs">{typeof barber.name === 'string' ? barber.name.substring(0, 2).toUpperCase() : "??"}</span>
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
