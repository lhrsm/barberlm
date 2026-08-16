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
import { 
  Users, 
  Scissors, 
  Calendar, 
  CircleDollarSign,
  TrendingUp,
  Target,
  Plus,
  UserPlus
} from "lucide-react";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";
import { AdminDashboardView } from "@/components/dashboard/views/AdminDashboardView";
import { ManagerDashboardView } from "@/components/dashboard/views/ManagerDashboardView";
import { FinanceDashboardView } from "@/components/dashboard/views/FinanceDashboardView";



export const Route = createFileRoute("/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { user, profile: authProfile, role, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { refresh: refreshLimits, loading: planLoading } = usePlanLimits();
  const loading = authLoading || tenantLoading || planLoading;
  
  const [isWalkinOpen, setIsWalkinOpen] = useState(false);
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
    weekly: {
      cashbackEarned: 0
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
      customersWithCashback: 0
    }
  });
  const [barbers, setBarbers] = useState<any[]>([]);
  const [dashboardTab, setDashboardTab] = useState<string>("daily");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [birthdayCustomers, setBirthdayCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    if (role === 'super_admin') {
      const impersonatedId = typeof window !== 'undefined' ? sessionStorage.getItem("impersonated_tenant_id") : null;
      if (!impersonatedId) {
        navigate({ to: "/admin/dashboard" });
        return;
      }
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!tenantId) return;

    fetchStats();
    fetchTodayAppointments();
    fetchBirthdayCustomers();

    const channel = supabase
      .channel(`dashboard-realtime-${tenantId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments', 
        filter: `tenant_id=eq.${tenantId}`
      }, () => {
        // Debounce or at least only refresh what's needed
        fetchTodayAppointments();
        fetchStats();
        refreshLimits();
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, selectedDate]);

  async function fetchBirthdayCustomers() {
    if (!tenantId) return;
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, birth_date, avatar_url")
      .eq("tenant_id", tenantId);

    if (data) {
      const currentMonthBirthdays = data.filter(c => {
        if (!c.birth_date) return false;
        let month = 0;
        let day = 0;
        
        if (c.birth_date.includes('-')) {
          const parts = c.birth_date.split('-');
          if (parts.length === 3) {
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
          }
        } else if (c.birth_date.includes('/')) {
          const parts = c.birth_date.split('/');
          if (parts.length >= 2) {
            day = parseInt(parts[0]);
            month = parseInt(parts[1]);
          }
        }
        
        return month === currentMonth && day >= todayDay;
      });
      setBirthdayCustomers(currentMonthBirthdays);
    }
  }

  async function fetchTodayAppointments() {
    if (!tenantId) return;
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();
    
    const { data, error } = await supabase
      .from("appointments")
      .select("*, customers(*), services(*), barbers(*)")
      .eq("tenant_id", tenantId)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .order("start_time", { ascending: false });

    if (error) {
      console.error("[Dashboard] fetchTodayAppointments error:", error);
      return;
    }
    if (data) setTodayAppointments(data);
  }

  async function fetchStats() {
    if (!tenantId) return;
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const [
      dailyApp, 
      monthlyApp, 
      dailyCust,
      monthlyCust,
      totalCust,
      totalServ,
      barbersData,
      dailyAppointmentsData,
      weeklyAppointmentsData,
      monthlyAppointmentsData,
      customersWithBalances
    ] = await Promise.all([
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).not("status", "eq", "cancelled").gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).not("status", "eq", "cancelled").gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("services").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("barbers").select("*").eq("tenant_id", tenantId).eq("active", true).limit(5),
      supabase.from("appointments").select("total_price, original_total, credit_used, cashback_used, cashback_earned, final_amount, payment_method")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("cashback_earned")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("start_time", weekStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("total_price, original_total, credit_used, cashback_used, cashback_earned, final_amount, payment_method")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("customers").select("cashback_balance").eq("tenant_id", tenantId)
    ]);

    const dailyServicesValue = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0) || 0;
    const dailyCashInflow = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.final_amount || 0), 0) || 0;
    const dailyCreditsUsed = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.credit_used || 0), 0) || 0;
    const dailyCashbackUsed = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_used || 0), 0) || 0;
    const dailyCashbackEarned = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_earned || 0), 0) || 0;
    
    const weeklyCashbackEarned = weeklyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_earned || 0), 0) || 0;

    const monthlyServicesValue = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0) || 0;
    const monthlyCashInflow = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.final_amount || 0), 0) || 0;
    const monthlyCreditsUsed = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.credit_used || 0), 0) || 0;
    const monthlyCashbackUsed = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_used || 0), 0) || 0;
    const monthlyCashbackEarned = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_earned || 0), 0) || 0;

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
      weekly: {
        cashbackEarned: weeklyCashbackEarned
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
        customersWithCashback: (customersWithBalances.data || []).filter(c => Number(c.cashback_balance || 0) > 0).length
      }
    });

    if (barbersData.data) setBarbers(barbersData.data);
  }

  if (loading || !user) return null;

  const renderSpecializedView = () => {
    switch (role) {
      case 'manager':
        return (
          <ManagerDashboardView
            stats={stats}
            todayAppointments={todayAppointments}
            barbers={barbers}
            birthdaysCount={birthdayCustomers.length}
            tenantId={tenantId || ""}
            navigate={navigate}
            name={authProfile?.responsible_name || authProfile?.full_name || user?.user_metadata?.full_name || user?.email}
          />
        );
      case 'finance':
        return (
          <FinanceDashboardView
            stats={stats}
            tenantId={tenantId || ""}
            navigate={navigate}
          />
        );
      default:
        return (
          <AdminDashboardView
            stats={stats}
            todayAppointments={todayAppointments}
            barbers={barbers}
            birthdayCustomers={birthdayCustomers}
            tenantId={tenantId || null}
            navigate={navigate}
            setIsWalkinOpen={setIsWalkinOpen}
            dashboardTab={dashboardTab}
            setDashboardTab={setDashboardTab}
            name={authProfile?.responsible_name || authProfile?.full_name || user?.user_metadata?.full_name || user?.email}
          />
        );
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] pb-20">
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
          {renderSpecializedView()}
        </div>

        <AppointmentModal />
        <WalkinModal 
          open={isWalkinOpen} 
          onOpenChange={setIsWalkinOpen}
          onSuccess={() => {
            fetchTodayAppointments();
            fetchStats();
          }}
        />
      </div>
    </AppLayout>
  );
}
