import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import { AdminDashboardView } from "@/components/dashboard/views/AdminDashboardView";
import { ManagerDashboardView } from "@/components/dashboard/views/ManagerDashboardView";
import { FinanceDashboardView } from "@/components/dashboard/views/FinanceDashboardView";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndexComponent,
});

function DashboardIndexComponent() {
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
    console.log("[DASHBOARD_BOOT_TRACE] Auth Check", { 
      loading, 
      authLoading, 
      tenantLoading, 
      planLoading, 
      hasUser: !!user, 
      role,
      tenantId 
    });

    if (loading) return;

    if (!user) {
      console.warn('[AUTH_REDIRECT_TRACE]', {
        source: 'DashboardIndexComponent',
        reason: 'No session found',
        pathname: window.location.pathname,
        timestamp: Date.now()
      });
      window.location.href = "/auth";
      return;
    }

    if (role === 'super_admin') {
      const impersonatedId = typeof window !== 'undefined' ? sessionStorage.getItem("impersonated_tenant_id") : null;
      if (!impersonatedId) {
        navigate({ to: "/admin/dashboard" });
        return;
      }
    }
  }, [user, role, loading, navigate, authLoading, tenantLoading, planLoading, tenantId]);

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
    
    console.log("[DASHBOARD_APPOINTMENT_FORENSIC] Fetching appointments", { 
      tenantId, 
      dayStart, 
      dayEnd,
      selectedDate: selectedDate.toISOString()
    });

    const { data, error } = await supabase
      .from("appointments")
      .select("*, customers(*), services(*), barbers(*)")
      .eq("tenant_id", tenantId)
      .in("status", ["scheduled", "confirmed", "completed", "in_progress", "pending"])
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .order("start_time", { ascending: false });

    if (error) {
      console.error("[DASHBOARD_APPOINTMENT_FORENSIC] Error:", error);
      return;
    }

    console.log("[DASHBOARD_APPOINTMENT_FORENSIC] Results:", {
      count: data?.length,
      ids: data?.map(a => a.id),
      ADMIN_APPOINTMENT_TRACE: {
        tenantId,
        ownerId: user?.id,
        filters: { dayStart, dayEnd, status: ["scheduled", "confirmed", "completed", "in_progress", "pending"] },
        rawRows: data?.length,
        appointmentIds: data?.map(a => a.id),
        renderedRows: data?.length
      }
    });

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
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed", "completed", "in_progress", "pending"]).gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed", "completed", "in_progress", "pending"]).gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("services").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("barbers").select("*").eq("tenant_id", tenantId).eq("active", true).limit(5),
      supabase.from("appointments").select("total_price, original_total, credit_used, cashback_used, cashback_earned, final_amount, payment_method, payment_status, status")
        .eq("tenant_id", tenantId)
        .in("status", ["completed", "confirmed", "scheduled", "pending"])
        .gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("cashback_earned")
        .eq("tenant_id", tenantId)
        .in("status", ["completed", "confirmed", "scheduled", "pending"])
        .gte("start_time", weekStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("total_price, original_total, credit_used, cashback_used, cashback_earned, final_amount, payment_method, payment_status, status")
        .eq("tenant_id", tenantId)
        .in("status", ["completed", "confirmed", "scheduled", "pending"])
        .gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("customers").select("cashback_balance").eq("tenant_id", tenantId)
    ]);

    const dailyServicesValue = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0) || 0;
    
    // Apenas agendamentos com payment_status = 'paid' entram no Faturamento Realizado (Real Cash Inflow)
    const dailyCashInflow = dailyAppointmentsData.data
      ?.filter(appt => appt.payment_status === 'paid' || appt.status === 'completed')
      ?.reduce((acc, curr) => acc + Number(curr.final_amount || 0), 0) || 0;
    const dailyCreditsUsed = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.credit_used || 0), 0) || 0;
    const dailyCashbackUsed = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_used || 0), 0) || 0;
    const dailyCashbackEarned = dailyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_earned || 0), 0) || 0;
    
    const weeklyCashbackEarned = weeklyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.cashback_earned || 0), 0) || 0;

    const monthlyServicesValue = monthlyAppointmentsData.data?.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0) || 0;
    const monthlyCashInflow = monthlyAppointmentsData.data
      ?.filter(appt => appt.payment_status === 'paid' || appt.status === 'completed')
      ?.reduce((acc, curr) => acc + Number(curr.final_amount || 0), 0) || 0;
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

  // Show loading skeleton while initializing
  if (loading || authLoading || tenantLoading) {
    return (
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-gold animate-spin mb-4" />
        <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
          Sincronizando Dashboard Executivo...
        </p>
      </div>
    );
  }

  // Handle unauthorized or uninitialized states
  if (!user || !tenantId) {
    if (!authLoading && !user) {
       console.warn('[AUTH_REDIRECT_TRACE] Final fallback redirect to /auth');
       window.location.href = "/auth";
    }
    return null;
  }

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
            name={authProfile?.responsible_name || authProfile?.full_name || user?.user_metadata?.responsible_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
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
            name={authProfile?.responsible_name || authProfile?.full_name || user?.user_metadata?.responsible_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
          />
        );
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
      {renderSpecializedView()}
      <WalkinModal 
        open={isWalkinOpen} 
        onOpenChange={setIsWalkinOpen}
        onSuccess={() => {
          fetchTodayAppointments();
          fetchStats();
        }}
      />
    </div>
  );
}
