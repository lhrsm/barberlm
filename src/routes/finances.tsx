import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Phone, ArrowRight, User, Timer, DollarSign, Package, MessageSquare, CreditCard, ChevronRight, Search, Eye, TicketPercent, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { Handshake } from "lucide-react";
import { Users, FileText, Calendar, Plus, TrendingUp, TrendingDown, Wallet, Edit2, Trash2, Clock, Check, X, Scissors, CircleDollarSign, CheckCircle2, XCircle, RefreshCcw, History, Crown, Calculator, FileDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { useFinancial } from "@/hooks/use-financial";
import { PayCommissionDialog } from "@/components/commissions/PayCommissionDialog";
import { ManagerialView } from "@/components/finances/ManagerialView";
import { CouponsView } from "@/components/finances/CouponsView";
import { AuditTrail } from "@/components/finances/AuditTrail";
import { RefundsTab } from "@/components/finances/RefundsTab";
import { PendingTab } from "@/components/finances/PendingTab";
import { SettingsTab } from "@/components/finances/SettingsTab";
import { BarbersTab } from "@/components/finances/BarbersTab";
import { EditTransactionDialog } from "@/components/finances/EditTransactionDialog";
import { TransactionsMobileList } from "@/components/finances/TransactionsMobileList";
import { TransactionsDesktopTable } from "@/components/finances/TransactionsDesktopTable";
import { KpiCards } from "@/components/finances/KpiCards";
import { FinancesHeader } from "@/components/finances/FinancesHeader";
import { FinancesTabsList } from "@/components/finances/FinancesTabsList";
import { exportFinancesPdf, periodLabel, type ReportPeriod } from "@/lib/finances-pdf";
import {
  TIMEZONE,
  formatTransactionTimeForEdit,
  formatTransactionDateForEdit,
  formatMixedPaymentLabel,
  computeBarberPeriodRange,
  isDateInBarberRange,
} from "@/lib/finances-helpers";


import { BarChart3 } from "lucide-react";

import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/finances")({
  component: FinancesComponent,
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
});

function FinancesComponent() {
  const queryClient = useQueryClient();
  const { user: authUser, loading: authLoading, role: authRole } = useAuth();
  const { session, loading: profLoading } = useProfessionalAuth();
  const navigate = useNavigate();
  const { plan } = usePlanLimits();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [barberCommissionSummaries, setBarberCommissionSummaries] = useState<Record<string, any>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ 
    amount: "", 
    type: "income", 
    description: "", 
    category: "Serviço", 
    barber_id: "none", 
    customer_id: "none",
    date: new Date().toISOString().split('T')[0], 
    time: "12:00",
    payment_method: "pix",
    pix_amount: "0",
    cash_amount: "0",
    credit_card_amount: "0",
    credits_amount: "0",
    cashback_amount: "0"
  });
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [financeTab, setFinanceTab] = useState<string>("transactions");
  const [globalPeriod, setGlobalPeriod] = useState<ReportPeriod>("month");
  const [isExportingPdf, setIsExportingPdf] = useState(false);


  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [barberPeriodPreset, setBarberPeriodPreset] = useState<string>("today");
  const [barberCustomStart, setBarberCustomStart] = useState<string>("");
  const [barberCustomEnd, setBarberCustomEnd] = useState<string>("");
  const barberPeriodRange = useMemo(
    () => computeBarberPeriodRange(barberPeriodPreset, barberCustomStart, barberCustomEnd),
    [barberPeriodPreset, barberCustomStart, barberCustomEnd],
  );
  const inBarberRange = (date?: string | null) => isDateInBarberRange(date, barberPeriodRange);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);
  const [cashbackTransactions, setCashbackTransactions] = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState({ total_cashback: 0, total_credits: 0 });
  const [customers, setCustomers] = useState<any[]>([]);
  
  const user = authUser || (session ? { id: session.barber_id } : null);
  const loading = authLoading || profLoading;
  const { summary: financialSummary, isLoading: loadingFinancial } = useFinancial(user?.id || null, dateFilter, dateFilter);
  
  // Refund filters
  const [refundStatusFilter, setRefundStatusFilter] = useState<string>("all");
  const [refundDateStartFilter, setRefundDateStartFilter] = useState<string>("");
  const [refundDateEndFilter, setRefundDateEndFilter] = useState<string>("");
  const [refundSearchTerm, setRefundSearchTerm] = useState<string>("");

  
  const role = authRole || (session ? 'barber' : null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (user && role !== 'super_admin') {
      const barberIdFilter = role === 'barber' ? user?.id : null;
      fetchTransactions(barberIdFilter);
      fetchBarbers();
      fetchAppointments(barberIdFilter);
      fetchRefundRequests();
      fetchCashbackTransactions();
      fetchCustomerStats(); 
      fetchCustomers();

      // Realtime subscription
      const channel = supabase
        .channel('finances-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'transactions',
          filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
        }, () => {
          fetchTransactions(barberIdFilter);
          queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'appointments',
          filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
        }, () => {
          fetchAppointments(barberIdFilter);
          fetchTransactions(barberIdFilter);
          queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'barber_commissions',
          filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
        }, () => {
          fetchBarberCommissionSummaries();
          queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'refund_requests',
          filter: `tenant_id=eq.${user.id}`
        }, () => {
          fetchRefundRequests();
          fetchCashbackTransactions();
          queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, role]);

  async function fetchBarbers() {
    if (!user) return;
    const { data } = await supabase
      .from("barbers")
      .select("id, name, commission_rate")
      .eq("user_id", user.id)
      .eq("active", true);
    setBarbers(data || []);
  }

  async function fetchBarberCommissionSummaries() {
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
  }

  useEffect(() => {
    if (user && barbers.length > 0) {
      fetchBarberCommissionSummaries();
    }
  }, [user?.id, barbers.length, barberPeriodRange.start, barberPeriodRange.end]);

  async function fetchTransactions(bId: string | null = null) {
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
    
    if (bId) {
      query = query.eq('barber_id', bId);
    }

    const { data } = await query.order("created_at", { ascending: false });
    setTransactions(data || []);
  }

  async function fetchAppointments(bId: string | null = null) {
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
    
    if (bId) {
      query = query.eq('barber_id', bId);
    }

    const { data } = await query.order("start_time", { ascending: false });
    setAppointments(data || []);
  }

  async function fetchRefundRequests() {
    if (!user) return;
    setLoadingRefunds(true);
    try {
      // Step 1: Fetch refund requests with basic columns first to avoid complex join errors
      let query = supabase
        .from("refund_requests")
        .select("*")
        .eq("tenant_id", user.id);
      
      if (refundStatusFilter !== "all") {
        query = query.eq("status", refundStatusFilter);
      }
      
      if (refundDateStartFilter) {
        query = query.gte("created_at", `${refundDateStartFilter}T00:00:00Z`);
      }
      
      if (refundDateEndFilter) {
        query = query.lte("created_at", `${refundDateEndFilter}T23:59:59Z`);
      }

      if (refundSearchTerm) {
        if (refundSearchTerm.length === 36) { // Likely UUID
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

      // Step 2: Fetch related customers and appointments manually to avoid join errors
      const customerIds = [...new Set(refunds.map(r => r.customer_id))];
      const appointmentIds = [...new Set(refunds.map(r => r.appointment_id))];

      const [{ data: customers }, { data: appts }] = await Promise.all([
        supabase.from("customers").select("id, name").in("id", customerIds),
        supabase.from("appointments").select("id, service_id, start_time, total_price").in("id", appointmentIds)
      ]);

      // Step 3: Map data
      const enrichedRefunds = refunds.map(r => ({
        ...r,
        customer: customers?.find(c => c.id === r.customer_id) || { name: "Cliente não encontrado" },
        appointment: appts?.find(a => a.id === r.appointment_id) || { service_name: "N/A", start_time: null }
      }));

      setRefundRequests(enrichedRefunds);
    } catch (err: any) {
      console.error("Error fetching refunds:", err);
      toast.error("Erro ao buscar solicitações de estorno");
      setRefundRequests([]); // Clear on error to avoid stale data
    } finally {
      setLoadingRefunds(false);
    }
  }

  useEffect(() => {
    if (user) {
      fetchRefundRequests();
    }
  }, [refundStatusFilter, refundDateStartFilter, refundDateEndFilter, refundSearchTerm]);

  async function handleUpdateRefundStatus(refundId: string, newStatus: string, notes?: string) {
    try {
      const updatePayload: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString()
      };

      if (notes !== undefined) updatePayload.admin_notes = notes;
      if (newStatus === 'completed') updatePayload.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("refund_requests")
        .update(updatePayload)
        .eq("id", refundId);

      if (error) throw error;
      
      // Trigger notification for status update
      if (['approved', 'completed', 'rejected'].includes(newStatus)) {
        // Fetch appointment_id for the refund
        const { data: refund } = await supabase
          .from("refund_requests")
          .select("appointment_id, amount")
          .eq("id", refundId)
          .single();

        if (refund) {
          await supabase.functions.invoke('appointment-notifications', {
            body: { 
              appointmentId: refund.appointment_id, 
              type: 'refund_updated',
              status: newStatus,
              amount: refund.amount,
              updatedBy: { type: 'admin' }
            }
          });
        }
      }
      if (newStatus === 'completed') {
        const { data: refund } = await supabase
          .from("refund_requests")
          .select("amount, appointment_id, tenant_id, payment_id")
          .eq("id", refundId)
          .single();

        if (refund) {
          const { data: appt } = await supabase
            .from("appointments")
            .select("services(name), customers(name), barber_id")
            .eq("id", refund.appointment_id)
            .single();

          // Create the financial transaction for the payout
          await supabase.from("transactions").insert({
            amount: refund.amount,
            type: "expense",
            description: `Estorno Pago (Pix): ${appt?.services?.name || "Serviço"} - ${appt?.customers?.name || "Cliente"}`,
            category: "Estorno",
            barber_id: appt?.barber_id,
            appointment_id: refund.appointment_id,
            user_id: refund.tenant_id,
            tenant_id: refund.tenant_id,
            date: new Date().toISOString().split('T')[0],
            payment_method: 'pix',
            pix_amount: refund.amount
          });
          
          // Update appointment refund status
          await supabase.from("appointments").update({
            refund_status: 'completed'
          }).eq("id", refund.appointment_id);
        }
      }

      toast.success(`Solicitação ${newStatus === 'approved' ? 'aprovada' : newStatus === 'completed' ? 'marcada como paga' : 'rejeitada'}!`);
      fetchRefundRequests();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }

  async function fetchCashbackTransactions() {
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
  }

  async function fetchCustomerStats() {
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
  }

  async function fetchCustomers() {
    if (!user) return;
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("tenant_id", user.id)
      .order("name");
    setCustomers(data || []);
  }

  const [totalCredits, setTotalCredits] = useState(0);
  const [totalCashback, setTotalCashback] = useState(0);
  const [isClearingData, setIsClearingData] = useState(false);

  const handleClearTestData = async () => {
    if (!user?.id) return;
    
    const confirm = window.confirm(
      "ATENÇÃO: Isso removerá TODOS os agendamentos, transações, estornos e históricos financeiros desta barbearia. \n\nClientes, barbeiros e serviços serão preservados.\n\nEsta ação NÃO PODE SER DESFEITA. Deseja continuar?"
    );

    if (!confirm) return;

    setIsClearingData(true);
    try {
      const { data, error } = await supabase.rpc('clear_barbershop_financial_data', {
        p_tenant_id: user.id
      });

      if (error) throw error;

      toast.success("Dados financeiros limpos com sucesso!");
      queryClient.invalidateQueries();
      fetchTransactions();
      fetchAppointments();
      fetchRefundRequests();
      fetchCashbackTransactions();
      fetchCustomerStats();
    } catch (err: any) {
      console.error("Error clearing data:", err);
      toast.error("Erro ao limpar dados: " + err.message);
    } finally {
      setIsClearingData(false);
    }
  };


  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchStatus = statusFilter === "all" || 
        (statusFilter === "manual" && !t.appointment && t.type !== 'credit_reversed' && t.type !== 'credit_granted' && t.type !== 'cashback_reversed') ||
        (statusFilter === "pix" && (t.payment_method === 'pix' || t.appointment?.payment_method === 'pix' || t.pix_amount > 0)) ||
        (statusFilter === "credits" && (t.payment_method === 'credits' || t.payment_method === 'wallet' || t.type === 'credit_reversed' || t.type === 'credit_granted' || t.credits_amount > 0)) ||
        (statusFilter === "cashback" && (t.payment_method === 'cashback' || t.type === 'cashback_reversed' || t.cashback_amount > 0)) ||
        (statusFilter === "expense" && t.type === 'expense') ||
        (t.appointment?.status === statusFilter);
      
      const matchDate = !dateFilter || t.date === dateFilter;
      
      return matchStatus && matchDate;
    });
  }, [transactions, statusFilter, dateFilter]);

  const summary = useMemo(() => {
    if (!financialSummary) {
      return {
        income: 0,
        realCashIncome: 0,
        servicesSold: 0,
        totalIncome: 0,
        totalExpense: 0,
        netRevenue: 0,
        balance: 0,
        usedCredits: 0,
        usedCashback: 0,
        cashbackConceded: 0,
        cashbackUsedTotal: 0,
        freelancersPart: 0,
        barbershopPart: 0,
        subscriptionCovered: 0,
        subscriptionExtra: 0,
        subscriptionAppointments: 0,
      };
    }

    const totalExpense = transactions.reduce((acc, t) => t.type === 'expense' ? acc + (parseFloat(String(t.amount)) || 0) : acc, 0);
    const totalRefundsPaid = (refundRequests || [])
      .filter(r => r && (r.status === 'completed' || r.status === 'paid'))
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const freelancersPart = barbers.reduce((acc, barber) => {
      const bApptIds = new Set();
      const bTotal = transactions
        .filter(t => t.barber_id === barber.id && t.type === 'income')
        .reduce((tAcc, t) => {
          if (t.appointment_id) {
            if (bApptIds.has(t.appointment_id)) return tAcc;
            bApptIds.add(t.appointment_id);
            // Considerar o valor total do serviço para comissão
            return tAcc + (Number(t.appointment?.original_total || t.appointment?.total_price || t.amount || 0));
          }
          return tAcc + (parseFloat(String(t.amount)) || 0);
        }, 0);
      return acc + (bTotal * (Number(barber.commission_rate || 0) / 100));
    }, 0);

    const subscriptionCovered = Number(financialSummary.assinatura_coberta || 0);
    const subscriptionExtra = Number(financialSummary.assinatura_extra || 0);
    const subscriptionAppointments = Number(financialSummary.atendimentos_assinatura || 0);

    return {
      income: financialSummary.servicos_vendidos,
      realCashIncome: financialSummary.entrada_caixa,
      servicesSold: financialSummary.servicos_vendidos,
      totalIncome: financialSummary.entrada_caixa,
      totalExpense,
      netRevenue: financialSummary.entrada_caixa - totalRefundsPaid,
      balance: financialSummary.entrada_caixa - totalExpense - totalRefundsPaid,
      usedCredits: financialSummary.creditos_utilizados,
      usedCashback: financialSummary.cashback_utilizado,
      cashbackConceded: financialSummary.cashback_concedido,
      cashbackUsedTotal: financialSummary.cashback_utilizado,
      freelancersPart,
      barbershopPart: financialSummary.servicos_vendidos - freelancersPart,
      subscriptionCovered,
      subscriptionExtra,
      subscriptionAppointments,
    };
  }, [financialSummary, transactions, refundRequests, barbers]);

  useEffect(() => {
    async function fetchBalances() {
      if (!user) return;
      const { data, error } = await supabase
        .from('customers')
        .select('credits, cashback_balance')
        .eq("user_id", user.id);
      
      if (!error && data) {
        const totalCred = data.reduce((acc, curr) => acc + (Number(curr.credits) || 0), 0);
        const totalCash = data.reduce((acc, curr) => acc + (Number(curr.cashback_balance) || 0), 0);
        setTotalCredits(totalCred);
        setTotalCashback(totalCash);
      }
    }
    if (user) fetchBalances();
  }, [user, transactions]); // Refresh when transactions change as they might involve credits

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await (supabase.from("transactions").insert as any)([{
      type: newTransaction.type,
      category: newTransaction.category,
      description: newTransaction.description,
      date: newTransaction.date,
      time: newTransaction.time,
      payment_method: newTransaction.payment_method,
      amount: parseFloat(newTransaction.amount) || 0,
      pix_amount: parseFloat(newTransaction.pix_amount) || 0,
      cash_amount: parseFloat(newTransaction.cash_amount) || 0,
      credit_card_amount: parseFloat(newTransaction.credit_card_amount) || 0,
      credits_amount: parseFloat(newTransaction.credits_amount) || 0,
      cashback_amount: parseFloat(newTransaction.cashback_amount) || 0,
      user_id: user.id,
      tenant_id: user.id,
      barber_id: newTransaction.barber_id === "none" ? null : newTransaction.barber_id,
      customer_id: newTransaction.customer_id === "none" ? null : newTransaction.customer_id,
    }]);

    if (error) {
      toast.error("Erro ao adicionar transação");
    } else {
      toast.success("Transação adicionada!");
      setIsAddDialogOpen(false);
      setNewTransaction({ 
        amount: "", 
        type: "income", 
        description: "", 
        category: "Serviço", 
        barber_id: "none", 
        customer_id: "none",
        date: new Date().toISOString().split('T')[0], 
        time: "12:00", 
        payment_method: "pix",
        pix_amount: "0",
        cash_amount: "0",
        credit_card_amount: "0",
        credits_amount: "0",
        cashback_amount: "0"
      });
      fetchTransactions();
      fetchCustomerStats();
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    }
  }

  async function handleUpdateTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !editingTransaction) return;

    if (!editingTransaction.adjustment_reason) {
      toast.error("O motivo do ajuste é obrigatório.");
      return;
    }

    const transactionAmount = parseFloat(editingTransaction.amount);
    if (isNaN(transactionAmount)) {
      toast.error("O valor total é inválido.");
      return;
    }

    const isMixed = editingTransaction.payment_method === 'misto' || editingTransaction.payment_method === 'mixed';
    
    // Validate mixed payment total
    if (isMixed) {
      const total = 
        Number(editingTransaction.pix_amount || 0) + 
        Number(editingTransaction.cash_amount || 0) + 
        Number(editingTransaction.credit_card_amount || 0) + 
        Number(editingTransaction.debit_card_amount || 0) + 
        Number(editingTransaction.credits_amount || 0) + 
        Number(editingTransaction.cashback_amount || 0);
      
      if (Math.abs(total - transactionAmount) > 0.01) {
        toast.error(`A soma das formas de pagamento (R$ ${total.toFixed(2)}) precisa ser igual ao valor total (R$ ${transactionAmount.toFixed(2)}).`);
        return;
      }
    }

    // Get original transaction for logging
    const originalTransaction = transactions.find(t => t.id === editingTransaction.id);

    const breakdown = isMixed ? {
      pix: Number(editingTransaction.pix_amount || 0),
      cash: Number(editingTransaction.cash_amount || 0),
      card_credit: Number(editingTransaction.credit_card_amount || 0),
      card_debit: Number(editingTransaction.debit_card_amount || 0),
      credits: Number(editingTransaction.credits_amount || 0),
      cashback: Number(editingTransaction.cashback_amount || 0)
    } : null;

    const updateData: any = {
      amount: parseFloat(editingTransaction.amount),
      type: editingTransaction.type,
      description: editingTransaction.description,
      category: editingTransaction.category,
      barber_id: editingTransaction.barber_id === "none" ? null : editingTransaction.barber_id,
      customer_id: editingTransaction.customer_id === "none" ? null : editingTransaction.customer_id,
      date: editingTransaction.date,
      time: editingTransaction.time,
      payment_method: isMixed ? 'mixed' : editingTransaction.payment_method,
      manual_adjustment: true,
      adjusted_by: user.id,
      adjusted_at: new Date().toISOString(),
      adjustment_reason: editingTransaction.adjustment_reason,
      pix_amount: editingTransaction.payment_method === 'pix' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.pix_amount || 0) : 0),
      cash_amount: editingTransaction.payment_method === 'cash' || editingTransaction.payment_method === 'dinheiro' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.cash_amount || 0) : 0),
      credit_card_amount: editingTransaction.payment_method === 'card' || editingTransaction.payment_method === 'credit_card' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.credit_card_amount || 0) : 0),
      debit_card_amount: editingTransaction.payment_method === 'debit_card' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.debit_card_amount || 0) : 0),
      credits_amount: editingTransaction.payment_method === 'credits' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.credits_amount || 0) : 0),
      cashback_amount: editingTransaction.payment_method === 'cashback' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.cashback_amount || 0) : 0),
      payment_breakdown: breakdown,
    };

    const { error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", editingTransaction.id);

    if (error) {
      toast.error("Erro ao atualizar transação");
      console.error(error);
    } else {
      // If there's an appointment, sync it too
      if (editingTransaction.appointment_id) {
        const finalAmount = updateData.pix_amount + updateData.cash_amount + updateData.credit_card_amount + updateData.debit_card_amount;
        
        await supabase.from("appointments").update({
          payment_method: updateData.payment_method,
          pix_amount: updateData.pix_amount,
          cash_amount: updateData.cash_amount,
          credit_card_amount: updateData.credit_card_amount,
          debit_card_amount: updateData.debit_card_amount,
          credits_used: updateData.credits_amount,
          cashback_used: updateData.cashback_amount,
          final_amount: finalAmount,
          total_price: updateData.amount
        }).eq("id", editingTransaction.appointment_id);
      }

      // Log the adjustment
      await supabase.from("financial_adjustment_logs").insert({
        transaction_id: editingTransaction.id,
        appointment_id: editingTransaction.appointment_id,
        tenant_id: editingTransaction.tenant_id,
        old_values: originalTransaction,
        new_values: updateData,
        reason: editingTransaction.adjustment_reason,
        adjusted_by: user.id,
        adjusted_at: new Date().toISOString()
      });

      toast.success("Transação atualizada e auditada!");
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      fetchTransactions();
      fetchAppointments();
      fetchCustomerStats();
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    }
  }

  async function handleDeleteTransaction(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir transação");
    } else {
      toast.success("Transação excluída!");
      fetchTransactions();
    }
  }

  if (authLoading) return null;
  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <FinancesHeader
          role={role}
          globalPeriod={globalPeriod}
          setGlobalPeriod={setGlobalPeriod}
          isExportingPdf={isExportingPdf}
          onExportPdf={async () => {
            if (plan === 'free') {
              toast.error("Relatórios PDF estão disponíveis apenas no plano Pro.");
              navigate({ to: "/subscription" });
              return;
            }
            try {
              setIsExportingPdf(true);
              toast.info(`Gerando PDF — ${periodLabel[globalPeriod]}...`);
              const { data: prof } = await supabase
                .from("profiles")
                .select("business_name, responsible_name")
                .eq("id", user.id)
                .maybeSingle();
              const fname = await exportFinancesPdf({
                tenantId: user.id,
                period: globalPeriod,
                businessName: prof?.business_name || prof?.responsible_name || "Barbex",
              });
              toast.success(`Relatório gerado: ${fname}`);
            } catch (err: any) {
              console.error(err);
              toast.error("Falha ao gerar PDF: " + (err?.message || "erro desconhecido"));
            } finally {
              setIsExportingPdf(false);
            }
          }}
          onSyncAll={() => fetchRefundRequests()}
          onRecalculateBalances={async () => {
            const { data: customers } = await supabase.from('customers').select('id, tenant_id').eq('tenant_id', user.id);
            if (customers) {
              toast.info(`Recalculando saldos de ${customers.length} clientes...`);
              for (const c of customers) {
                await supabase.rpc('recalculate_customer_credit_balance', { p_customer_id: c.id });
                await supabase.rpc('recalculate_customer_cashback_balance', { p_customer_id: c.id });
              }
              fetchTransactions();
              fetchCustomerStats();
              queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
              fetchCashbackTransactions();
              fetchCustomerStats();
              toast.success("Saldos recalculados com sucesso!");
            }
          }}
        >
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>

            <DialogTrigger asChild>
              <Button className="gap-2 whitespace-nowrap w-full md:w-auto h-11 px-6 rounded-[14px] font-bold border-0 text-black bg-gradient-to-b from-[#F5D062] to-[#C9971A] shadow-[0_10px_26px_-10px_rgba(212,175,55,0.75)] transition-all duration-200 hover:bg-gradient-to-b hover:from-[#FFE082] hover:to-[#D4AF37] hover:shadow-[0_16px_36px_-12px_rgba(212,175,55,0.9)] hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-100">
                <Plus size={18} strokeWidth={3} /> Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Transação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTransaction} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input 
                      id="date" 
                      type="date"
                      value={newTransaction.date} 
                      onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Horário</Label>
                    <Input 
                      id="time" 
                      type="time"
                      value={newTransaction.time} 
                      onChange={(e) => setNewTransaction({...newTransaction, time: e.target.value})} 
                      required 
                      className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl"
                    />
                  </div>
                </div>


                                <div className="space-y-2">
                                  <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor Total (R$)</Label>
                  <Input 
                    id="amount" 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newTransaction.amount} 
                    onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})} 
                    required 
                    className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cliente (Opcional)</Label>
                  <Select 
                    value={newTransaction.customer_id} 
                    onValueChange={(val) => setNewTransaction({...newTransaction, customer_id: val})}
                  >
                    <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                      <SelectItem value="none" className="focus:bg-amber-500/20">Nenhum / Geral</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="focus:bg-amber-500/20">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipo de Movimentação</Label>
                  <Select 
                    value={newTransaction.type} 
                    onValueChange={(val) => setNewTransaction({...newTransaction, type: val})}
                  >
                    <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada (Receita)</SelectItem>
                      <SelectItem value="expense">Saída (Despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Forma de Pagamento</Label>
                  <Select 
                    value={newTransaction.payment_method} 
                    onValueChange={(val) => setNewTransaction({...newTransaction, payment_method: val})}
                  >
                    <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="wallet">Créditos</SelectItem>
                      <SelectItem value="cashback">Cashback</SelectItem>
                      <SelectItem value="misto">Misto (Múltiplas Formas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {(newTransaction.payment_method === 'misto' || newTransaction.payment_method === 'mixed') && (
                  <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Detalhamento Misto</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-zinc-500">PIX</Label>
                        <Input type="number" step="0.01" value={newTransaction.pix_amount} onChange={(e) => setNewTransaction({...newTransaction, pix_amount: e.target.value})} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-zinc-500">Dinheiro</Label>
                        <Input type="number" step="0.01" value={newTransaction.cash_amount} onChange={(e) => setNewTransaction({...newTransaction, cash_amount: e.target.value})} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-zinc-500">Cartão</Label>
                        <Input type="number" step="0.01" value={newTransaction.credit_card_amount} onChange={(e) => setNewTransaction({...newTransaction, credit_card_amount: e.target.value})} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-zinc-500">Créditos</Label>
                        <Input type="number" step="0.01" value={newTransaction.credits_amount} onChange={(e) => setNewTransaction({...newTransaction, credits_amount: e.target.value})} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-zinc-500">Cashback</Label>
                        <Input type="number" step="0.01" value={newTransaction.cashback_amount} onChange={(e) => setNewTransaction({...newTransaction, cashback_amount: e.target.value})} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Categoria</Label>
                  <Input 
                    id="category" 
                    placeholder="Serviço, Aluguel, Produtos, etc."
                    value={newTransaction.category} 
                    onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})} 
                    className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barber_id" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Barbeiro Responsável</Label>
                  <Select 
                    value={newTransaction.barber_id} 
                    onValueChange={(val) => setNewTransaction({...newTransaction, barber_id: val})}
                  >
                    <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                      <SelectValue placeholder="Selecione um barbeiro" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                      <SelectItem value="none" className="focus:bg-amber-500/20">Nenhum / Geral</SelectItem>
                      {barbers.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="focus:bg-amber-500/20">{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input 
                    id="description" 
                    value={newTransaction.description} 
                    onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})} 
                  />
                </div>
                <Button type="submit" className="w-full bg-black text-white hover:scale-105 transition-all h-12 rounded-xl font-bold uppercase tracking-tight">Salvar</Button>
              </form>
            </DialogContent>
            </Dialog>
        </FinancesHeader>




        <KpiCards
          summary={summary}
          role={role}
          refundRequests={refundRequests || []}
          customerStats={customerStats}
          appointments={appointments}
          dateFilter={dateFilter}
        />

        <Tabs value={financeTab} onValueChange={setFinanceTab} className="w-full">
          <FinancesTabsList role={role} financeTab={financeTab} setFinanceTab={setFinanceTab} />



          {role !== 'barber' && user && (
            <TabsContent value="managerial" className="pt-4">
              <ManagerialView tenantId={user.id} initialPeriod={globalPeriod as any} periodKey={globalPeriod} />
            </TabsContent>
          )}

          {role !== 'barber' && user && (
            <TabsContent value="coupons" className="pt-4">
              <CouponsView tenantId={user.id} initialPeriod={globalPeriod as any} periodKey={globalPeriod} />
            </TabsContent>
          )}


          <TabsContent value="transactions" className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-4 items-end bg-card p-4 border border-border rounded-xl text-foreground">
              <div className="space-y-2">
                <Label htmlFor="filter-status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="filter-status" className="w-[180px] bg-background border-border">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                    <SelectItem value="manual">Lançamentos Manuais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-date">Data</Label>
                <Input 
                  id="filter-date" 
                  type="date" 
                  className="w-[180px] bg-background border-border" 
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setStatusFilter("all");
                  setDateFilter(new Date().toISOString().split('T')[0]);
                }}
                className="h-10 hover:bg-accent hover:text-accent-foreground"
              >
                Limpar Filtros
              </Button>
            </div>

            <div className="border border-border rounded-xl bg-card text-foreground overflow-hidden shadow-sm">
              <TransactionsDesktopTable
                transactions={filteredTransactions}
                role={role ?? undefined}
                onEdit={(t) => {
                  setEditingTransaction(t);
                  setIsEditDialogOpen(true);
                }}
                onOpenDetails={(id) => {
                  setSelectedAppointmentId(id);
                  setIsDetailsModalOpen(true);
                }}
                onDelete={handleDeleteTransaction}
              />

              <EditTransactionDialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                  if (!open) {
                    setIsEditDialogOpen(false);
                    setEditingTransaction(null);
                  }
                }}
                editingTransaction={editingTransaction}
                setEditingTransaction={setEditingTransaction}
                onSubmit={handleUpdateTransaction}
                customers={customers}
                barbers={barbers}
              />


              {/* Mobile Cards */}
              <TransactionsMobileList
                transactions={filteredTransactions}
                onOpenDetails={(id) => {
                  setSelectedAppointmentId(id);
                  setIsDetailsModalOpen(true);
                }}
                onEdit={(t) => {
                  setEditingTransaction(t);
                  setIsEditDialogOpen(true);
                }}
                onDelete={handleDeleteTransaction}
              />

            </div>
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab handleClearTestData={handleClearTestData} isClearingData={isClearingData} />
        </TabsContent>

          <TabsContent value="pending" className="pt-4">
            <PendingTab
              appointments={appointments}
              role={role}
              onOpenDetails={(id) => {
                setSelectedAppointmentId(id);
                setIsDetailsModalOpen(true);
              }}
            />
          </TabsContent>


          <TabsContent value="barbers" className="pt-4 space-y-4">
            <BarbersTab
              tenantId={user.id}
              barbers={barbers}
              barberCommissionSummaries={barberCommissionSummaries}
              transactions={transactions}
              barberPeriodPreset={barberPeriodPreset}
              setBarberPeriodPreset={setBarberPeriodPreset}
              barberCustomStart={barberCustomStart}
              setBarberCustomStart={setBarberCustomStart}
              barberCustomEnd={barberCustomEnd}
              setBarberCustomEnd={setBarberCustomEnd}
              barberPeriodRange={barberPeriodRange}
              inBarberRange={inBarberRange}
              onCommissionPaid={fetchBarberCommissionSummaries}
            />
          </TabsContent>


          <TabsContent value="refunds" className="pt-0">
            <RefundsTab
              refundRequests={refundRequests}
              loadingRefunds={loadingRefunds}
              refundStatusFilter={refundStatusFilter}
              setRefundStatusFilter={setRefundStatusFilter}
              refundDateStartFilter={refundDateStartFilter}
              setRefundDateStartFilter={setRefundDateStartFilter}
              refundDateEndFilter={refundDateEndFilter}
              setRefundDateEndFilter={setRefundDateEndFilter}
              refundSearchTerm={refundSearchTerm}
              setRefundSearchTerm={setRefundSearchTerm}
              handleUpdateRefundStatus={handleUpdateRefundStatus}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      <AppointmentDetailsModal 
        appointmentId={selectedAppointmentId || undefined}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        onSuccess={() => {
          const barberIdFilter = role === 'barber' ? user?.id : null;
          fetchTransactions(barberIdFilter);
          fetchAppointments(barberIdFilter);
        }}
      />
    </AppLayout>
  );
}

