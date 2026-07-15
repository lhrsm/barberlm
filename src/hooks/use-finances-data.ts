import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Params {
  user: { id: string } | null;
  role: string | null;
  barberPeriodRange: { start?: string; end?: string };
  refundStatusFilter: string;
  refundDateStartFilter: string;
  refundDateEndFilter: string;
  refundSearchTerm: string;
}

export function useFinancesData({
  user,
  role,
  barberPeriodRange,
  refundStatusFilter,
  refundDateStartFilter,
  refundDateEndFilter,
  refundSearchTerm,
}: Params) {
  const queryClient = useQueryClient();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [barberCommissionSummaries, setBarberCommissionSummaries] = useState<Record<string, any>>({});
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);
  const [cashbackTransactions, setCashbackTransactions] = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState({ total_cashback: 0, total_credits: 0 });
  const [customers, setCustomers] = useState<any[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [totalCashback, setTotalCashback] = useState(0);

  const fetchBarbers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("barbers")
      .select("id, name, commission_rate")
      .eq("user_id", user.id)
      .eq("active", true);
    setBarbers(data || []);
  }, [user]);

  const fetchBarberCommissionSummaries = useCallback(async () => {
    if (!user || barbers.length === 0) return;
    const summaries = await Promise.all(
      barbers.map(async (barber) => {
        const { data } = await supabase.rpc("get_barber_commission_summary", {
          p_tenant_id: user.id,
          p_barber_id: barber.id,
          p_start_date: barberPeriodRange.start || undefined,
          p_end_date: barberPeriodRange.end || undefined,
        });
        return [barber.id, data || {}] as const;
      })
    );
    setBarberCommissionSummaries(Object.fromEntries(summaries));
  }, [user, barbers, barberPeriodRange.start, barberPeriodRange.end]);

  const fetchTransactions = useCallback(async (bId: string | null = null) => {
    if (!user) return;
    let query = supabase
      .from("transactions")
      .select(`
        *,
        barber:barbers(name),
        appointment:appointments(
          status, 
          payment_method, 
          credit_used, 
          credits_used,
          original_total, 
          final_amount, 
          total_price, 
          start_time, 
          customers(name),
          services(name),
          pix_amount,
          cashback_used
        )
      `)
      .eq("user_id", user.id);

    if (bId) query = query.eq('barber_id', bId);
    const { data } = await query.order("created_at", { ascending: false });
    setTransactions(data || []);
  }, [user]);

  const fetchAppointments = useCallback(async (bId: string | null = null) => {
    if (!user) return;
    let query = supabase
      .from("appointments")
      .select(`
        *,
        customers(name),
        services(name),
        barber:barbers!appointments_barber_id_fkey(name)
      `)
      .eq("user_id", user.id)
      .eq("payment_status", "pending")
      .neq("status", "cancelled");

    if (bId) query = query.eq('barber_id', bId);
    const { data } = await query.order("start_time", { ascending: false });
    setAppointments(data || []);
  }, [user]);

  const fetchRefundRequests = useCallback(async () => {
    if (!user) return;
    setLoadingRefunds(true);
    try {
      let query = supabase
        .from("refund_requests")
        .select("*")
        .eq("tenant_id", user.id);

      if (refundStatusFilter !== "all") query = query.eq("status", refundStatusFilter);
      if (refundDateStartFilter) query = query.gte("created_at", `${refundDateStartFilter}T00:00:00Z`);
      if (refundDateEndFilter) query = query.lte("created_at", `${refundDateEndFilter}T23:59:59Z`);
      if (refundSearchTerm) {
        if (refundSearchTerm.length === 36) {
          query = query.or(`appointment_id.eq.${refundSearchTerm},payment_id.ilike.%${refundSearchTerm}%`);
        } else {
          query = query.ilike('payment_id', `%${refundSearchTerm}%`);
        }
      }

      const { data: refunds, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      if (!refunds || refunds.length === 0) {
        setRefundRequests([]);
        return;
      }

      const customerIds = [...new Set(refunds.map(r => r.customer_id))];
      const appointmentIds = [...new Set(refunds.map(r => r.appointment_id))];
      const [{ data: cs }, { data: appts }] = await Promise.all([
        supabase.from("customers").select("id, name").in("id", customerIds),
        supabase.from("appointments").select("id, service_id, start_time, total_price").in("id", appointmentIds)
      ]);

      const enriched = refunds.map(r => ({
        ...r,
        customer: cs?.find(c => c.id === r.customer_id) || { name: "Cliente não encontrado" },
        appointment: appts?.find(a => a.id === r.appointment_id) || { service_name: "N/A", start_time: null }
      }));
      setRefundRequests(enriched);
    } catch (err: any) {
      console.error("Error fetching refunds:", err);
      toast.error("Erro ao buscar solicitações de estorno");
      setRefundRequests([]);
    } finally {
      setLoadingRefunds(false);
    }
  }, [user, refundStatusFilter, refundDateStartFilter, refundDateEndFilter, refundSearchTerm]);

  const fetchCashbackTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("cashback_transactions")
        .select("*")
        .eq("tenant_id", user.id);
      if (error) throw error;
      setCashbackTransactions(data || []);
    } catch (err) {
      console.error("Error fetching cashback transactions:", err);
    }
  }, [user]);

  const fetchCustomerStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("cashback_balance, credits")
        .eq("tenant_id", user.id);
      if (error) throw error;
      const totals = (data || []).reduce((acc, curr) => ({
        total_cashback: acc.total_cashback + Number(curr.cashback_balance || 0),
        total_credits: acc.total_credits + Number(curr.credits || 0)
      }), { total_cashback: 0, total_credits: 0 });
      setCustomerStats(totals);
    } catch (err) {
      console.error("Error fetching customer stats:", err);
    }
  }, [user]);

  const fetchCustomers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("tenant_id", user.id)
      .order("name");
    setCustomers(data || []);
  }, [user]);

  // Initial fetch + realtime
  useEffect(() => {
    if (!user || role === 'super_admin') return;
    const barberIdFilter = role === 'barber' ? user.id : null;
    fetchTransactions(barberIdFilter);
    fetchBarbers();
    fetchAppointments(barberIdFilter);
    fetchRefundRequests();
    fetchCashbackTransactions();
    fetchCustomerStats();
    fetchCustomers();

    const channel = supabase
      .channel('finances-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
      }, () => {
        fetchTransactions(barberIdFilter);
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
      }, () => {
        fetchAppointments(barberIdFilter);
        fetchTransactions(barberIdFilter);
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'barber_commissions',
        filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
      }, () => {
        fetchBarberCommissionSummaries();
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'refund_requests',
        filter: `tenant_id=eq.${user.id}`
      }, () => {
        fetchRefundRequests();
        fetchCashbackTransactions();
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  useEffect(() => {
    if (user && barbers.length > 0) fetchBarberCommissionSummaries();
  }, [user?.id, barbers.length, barberPeriodRange.start, barberPeriodRange.end, fetchBarberCommissionSummaries]);

  useEffect(() => {
    if (user) fetchRefundRequests();
  }, [refundStatusFilter, refundDateStartFilter, refundDateEndFilter, refundSearchTerm, user, fetchRefundRequests]);

  useEffect(() => {
    async function fetchBalances() {
      if (!user) return;
      const { data, error } = await supabase
        .from('customers')
        .select('credits, cashback_balance')
        .eq("user_id", user.id);
      if (!error && data) {
        setTotalCredits(data.reduce((acc, c) => acc + (Number(c.credits) || 0), 0));
        setTotalCashback(data.reduce((acc, c) => acc + (Number(c.cashback_balance) || 0), 0));
      }
    }
    if (user) fetchBalances();
  }, [user, transactions]);

  return {
    transactions,
    appointments,
    barbers,
    barberCommissionSummaries,
    refundRequests,
    loadingRefunds,
    cashbackTransactions,
    customerStats,
    customers,
    totalCredits,
    totalCashback,
    fetchTransactions,
    fetchBarbers,
    fetchAppointments,
    fetchRefundRequests,
    fetchCashbackTransactions,
    fetchCustomerStats,
    fetchCustomers,
    fetchBarberCommissionSummaries,
  };
}
