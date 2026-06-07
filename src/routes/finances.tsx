import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Phone, ArrowRight, User, Timer, DollarSign, Package, MessageSquare, CreditCard, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Handshake } from "lucide-react";
import { Users, FileText, Calendar, Plus, TrendingUp, TrendingDown, Wallet, Edit2, Trash2, Clock, Check, X, Scissors, CircleDollarSign, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/finances")({
  component: FinancesComponent,
});

function FinancesComponent() {
  const { user: authUser, loading: authLoading, role: authRole } = useAuth();
  const { session, loading: profLoading } = useProfessionalAuth();
  const navigate = useNavigate();
  const { plan } = usePlanLimits();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ 
    amount: "", 
    type: "income", 
    description: "", 
    category: "Serviço", 
    barber_id: "none", 
    date: new Date().toISOString().split('T')[0], 
    time: "12:00",
    payment_method: "cash"
  });
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [barberDateFilter, setBarberDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);

  const TIMEZONE = "America/Sao_Paulo";

  const formatTransactionTimeForEdit = (transaction: any) => {
    if (transaction.appointment?.start_time) {
      return formatInTimeZone(new Date(transaction.appointment.start_time), TIMEZONE, 'HH:mm');
    }
    if (typeof transaction.time === 'string') {
      return transaction.time.substring(0, 5);
    }
    return "12:00";
  };

  const formatTransactionDateForEdit = (transaction: any) => {
    if (transaction.appointment?.start_time) {
      return formatInTimeZone(new Date(transaction.appointment.start_time), TIMEZONE, 'yyyy-MM-dd');
    }
    return transaction.date || new Date().toISOString().split('T')[0];
  };
  
  const user = authUser || (session ? { id: session.barber_id } : null);
  const role = authRole || (session ? 'barber' : null);
  const loading = authLoading || profLoading;

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
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'appointments',
          filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
        }, () => {
          fetchAppointments(barberIdFilter);
          fetchTransactions(barberIdFilter);
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'refund_requests',
          filter: `tenant_id=eq.${user.id}`
        }, () => {
          fetchRefundRequests();
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
        barber:barbers(name)
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
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*, customer:customers(name), appointment:appointments(service_name, start_time)")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setRefundRequests(data || []);
    } catch (err: any) {
      toast.error("Erro ao buscar solicitações de estorno");
    } finally {
      setLoadingRefunds(false);
    }
  }

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

      toast.success(`Solicitação ${newStatus === 'approved' ? 'aprovada' : newStatus === 'completed' ? 'marcada como paga' : 'rejeitada'}!`);
      fetchRefundRequests();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }

  const [totalCredits, setTotalCredits] = useState(0);
  const [totalCashback, setTotalCashback] = useState(0);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchStatus = statusFilter === "all" || 
        (statusFilter === "manual" && !t.appointment) ||
        (t.appointment?.status === statusFilter);
      
      const matchDate = !dateFilter || t.date === dateFilter;
      
      return matchStatus && matchDate;
    });
  }, [transactions, statusFilter, dateFilter]);

  const summary = useMemo(() => {
    // FILTRAR APENAS TRANSAÇÕES DE AGENDAMENTOS CONCLUÍDOS OU MANUAIS
    const effectiveTransactions = transactions.filter(t => 
      !t.appointment || t.appointment.status === 'completed' || t.appointment.status === 'confirmed' || t.appointment.status === 'scheduled'
    );

    // 1. Serviços Vendidos Hoje (Faturamento Operacional) - Somar o valor total dos serviços realizados/concluídos.
    const operationalRevenue = effectiveTransactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => {
        if (t.appointment) {
          // Use total_price as the total service value
          return acc + (Number(t.appointment.total_price || t.appointment.original_total) || 0);
        }
        // For manual entries, include extra amounts that might not be in 'amount'
        const extraAmounts = Number(t.credits_amount || 0) + Number(t.cashback_amount || 0);
        return acc + (parseFloat(String(t.amount)) || 0) + extraAmounts;
      }, 0);

    // 2. Entrada em Caixa Hoje (Fluxo de Caixa) - Dinheiro novo no caixa (PIX, Dinheiro, Cartão)
    // NÃO incluir cashback ou créditos
    const realCashIncome = effectiveTransactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => {
        // Se houver valores detalhados de pagamento, usar eles (preferência para ajustes manuais ou mistos)
        if (t.payment_method === 'misto' || t.payment_method === 'mixed' || t.manual_adjustment) {
          const cashFlow = Number(t.pix_amount || 0) + Number(t.cash_amount || 0) + Number(t.credit_card_amount || 0) + Number(t.debit_card_amount || 0);
          return acc + cashFlow;
        }

        // Se for via cashback ou créditos no método de pagamento, não deve contar no caixa real
        const method = t.payment_method || t.appointment?.payment_method;
        if (method === 'cashback' || method === 'credits') {
          return acc;
        }
        return acc + (parseFloat(String(t.amount)) || 0);
      }, 0);

    // 3. Créditos Utilizados Hoje
    const creditsConsumed = effectiveTransactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => {
        if (t.payment_method === 'misto' || t.payment_method === 'mixed' || t.manual_adjustment) {
          return acc + Number(t.credits_amount || 0);
        }
        let val = Number(t.appointment?.credit_used || 0) + Number(t.appointment?.credits_used || 0);
        // Fallback: se o valor for 0 mas o método for créditos, usar o valor da transação
        if (val === 0 && t.appointment?.payment_method === 'credits') {
          val = parseFloat(String(t.amount)) || 0;
        }
        return acc + val;
      }, 0);

    // 4. Cashback Utilizado Hoje
    const cashbackConsumed = effectiveTransactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => {
        if (t.payment_method === 'misto' || t.payment_method === 'mixed' || t.manual_adjustment) {
          return acc + Number(t.cashback_amount || 0);
        }
        let val = Number(t.appointment?.cashback_used || 0);
        // Fallback: se o valor for 0 mas o método for cashback, usar o valor da transação
        if (val === 0 && t.appointment?.payment_method === 'cashback') {
          val = parseFloat(String(t.amount)) || 0;
        }
        return acc + val;
      }, 0);

    const expense = effectiveTransactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + (parseFloat(String(t.amount)) || 0), 0);
    
    // Pendentes são agendamentos que ainda não foram concluídos
    const pending = appointments
      .reduce((acc, app) => acc + (parseFloat(String(app.total_price)) || 0), 0);


    // Parte dos Freelancers (Comissão baseada no Valor Total do Serviço)
    const freelancersPart = barbers.reduce((acc, barber) => {
      const bTransactions = effectiveTransactions.filter(t => 
        t.barber_id === barber.id && 
        t.type === 'income'
      );
      const bTotal = bTransactions.reduce((tAcc, t) => {
        if (t.appointment) {
          return tAcc + (Number(t.appointment.original_total || t.appointment.total_price || (Number(t.amount) + Number(t.appointment.credit_used || 0) + Number(t.appointment.cashback_used || 0))) || 0);
        }
        
        const val = parseFloat(String(t.amount)) || 0;
        let creditedAmount = 0;
        let cashbackUsedAmount = 0;
        
        if (t.description?.includes("Créditos: R$")) {
          const match = t.description?.match(/Créditos: R\$\s*([\d.]+)/);
          creditedAmount = match ? parseFloat(match[1]) : 0;
        }
        if (t.description?.includes("Cashback: R$")) {
          const match = t.description?.match(/Cashback: R\$\s*([\d.]+)/);
          cashbackUsedAmount = match ? parseFloat(match[1]) : 0;
        }
        return tAcc + val + creditedAmount + cashbackUsedAmount;
      }, 0);
      const commissionRate = Number(barber.commission_rate || 0);
      return acc + (bTotal * (commissionRate / 100));
    }, 0);

    const barbershopPart = operationalRevenue - freelancersPart;

    return { 
      income: operationalRevenue, 
      realCashIncome,
      creditsConsumed,
      cashbackConsumed,
      expense, 
      pending, 
      balance: realCashIncome - expense, // Saldo Atual é Dinheiro Real - Despesas
      freelancersPart, 
      barbershopPart 
    };
  }, [transactions, appointments, barbers]);

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

    const { error } = await supabase.from("transactions").insert({
      ...newTransaction,
      amount: parseFloat(newTransaction.amount),
      user_id: user.id,
      barber_id: newTransaction.barber_id === "none" ? null : newTransaction.barber_id,
    });

    if (error) {
      toast.error("Erro ao adicionar transação");
    } else {
      toast.success("Transação adicionada!");
      setIsAddDialogOpen(false);
      setNewTransaction({ amount: "", type: "income", description: "", category: "Serviço", barber_id: "none", date: new Date().toISOString().split('T')[0], time: "12:00", payment_method: "cash" });
      fetchTransactions();
    }
  }

  async function handleUpdateTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !editingTransaction) return;

    if (!editingTransaction.adjustment_reason) {
      toast.error("O motivo do ajuste é obrigatório.");
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
      
      const transactionAmount = parseFloat(editingTransaction.amount);
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
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Financeiro</h2>
            <p className="text-muted-foreground text-sm">Controle suas entradas e saídas.</p>
          </div>
          <div className="flex flex-col gap-3">
            {role !== 'barber' && (
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={() => {
                  if (plan === 'free') {
                    toast.error("Relatórios PDF estão disponíveis apenas no plano Pro.");
                    navigate({ to: "/subscription" });
                  } else {
                    toast.info("Gerando relatório PDF...");
                  }
                }}
              >
                <Wallet size={18} /> Exportar PDF
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus size={18} /> Nova Transação
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
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input 
                    id="amount" 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newTransaction.amount} 
                    onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select 
                    value={newTransaction.type} 
                    onValueChange={(val) => setNewTransaction({...newTransaction, type: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada (Receita)</SelectItem>
                      <SelectItem value="expense">Saída (Despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input 
                    id="category" 
                    placeholder="Serviço, Aluguel, Produtos, etc."
                    value={newTransaction.category} 
                    onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barber">Barbeiro</Label>
                  <Select 
                    value={newTransaction.barber_id} 
                    onValueChange={(val) => setNewTransaction({...newTransaction, barber_id: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um barbeiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum / Geral</SelectItem>
                      {barbers.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
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
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Serviços Vendidos</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Scissors className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">R$ {summary.income.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Total de serviços concluídos</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Entrada em Caixa</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CircleDollarSign className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">R$ {summary.realCashIncome.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Dinheiro novo (PIX/Cartão/Dinheiro)</p>
            </CardContent>
          </Card>

          {role !== 'barber' && (
            <>
              <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold">Cashback Utilizado</CardTitle>
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Wallet className="h-4 w-4 text-orange-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">R$ {summary.cashbackConsumed.toFixed(2)}</div>
                  <p className="text-[10px] text-muted-foreground font-medium mt-1">Abatido via cashback</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold">Saídas</CardTitle>
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">R$ {summary.expense.toFixed(2)}</div>
                  <p className="text-[10px] text-muted-foreground font-medium mt-1">Despesas e estornos</p>
                </CardContent>
              </Card>
            </>
          )}

          <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">{role === 'barber' ? 'Minha Comissão' : 'Freelancers'}</CardTitle>
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Users className="h-4 w-4 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-400">R$ {summary.freelancersPart.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">{role === 'barber' ? 'Minha parte garantida' : 'Comissões (Total serviços)'}</p>
            </CardContent>
          </Card>

          {role !== 'barber' && (
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold">Créditos Utilizados</CardTitle>
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Wallet className="h-4 w-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">R$ {summary.creditsConsumed.toFixed(2)}</div>
                <p className="text-[10px] text-muted-foreground font-medium mt-1">Abatido via créditos</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Pendente</CardTitle>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">R$ {summary.pending.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Aguardando pagamento</p>
            </CardContent>
          </Card>

          {role !== 'barber' && (
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold">Saldo em Caixa</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">R$ {summary.balance.toFixed(2)}</div>
                <p className="text-[10px] text-muted-foreground font-medium mt-1">Real em caixa (Entrada - Saída)</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px] bg-card border border-border text-foreground">
            <TabsTrigger value="transactions" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText size={16} /> Lançamentos
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock size={16} /> Pendentes
            </TabsTrigger>
            {role !== 'barber' && (
              <TabsTrigger value="barbers" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users size={16} /> Por Barbeiro
              </TabsTrigger>
            )}
          </TabsList>

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
                  setDateFilter("");
                }}
                className="h-10 hover:bg-accent hover:text-accent-foreground"
              >
                Limpar Filtros
              </Button>
            </div>

            <div className="border border-border rounded-xl bg-card text-foreground overflow-hidden shadow-sm">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-background">
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="w-[100px] text-muted-foreground">Data</TableHead>
                      <TableHead className="w-[100px] text-muted-foreground">Hora</TableHead>
                      <TableHead className="text-muted-foreground">Descrição</TableHead>
                      {role !== 'barber' && <TableHead className="text-muted-foreground">Barbeiro</TableHead>}
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Pagamento</TableHead>
                      <TableHead className="text-muted-foreground">Categoria</TableHead>
                      <TableHead className="text-right text-muted-foreground">Valor</TableHead>
                      <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhuma transação encontrada com os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((t) => (
                      <TableRow key={t.id} className="border-border hover:bg-muted/50 transition-colors">
                        <TableCell className="whitespace-nowrap text-foreground">
                          {t.appointment?.start_time 
                            ? new Date(t.appointment.start_time).toLocaleDateString('pt-BR')
                            : (t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR') : "-")}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {t.appointment?.start_time 
                              ? format(new Date(t.appointment.start_time), 'HH:mm')
                              : (typeof t.time === 'string' ? t.time.substring(0, 5) : "--:--")}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {t.appointment?.customers?.name ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Cliente: {t.appointment.customers.name}</span>
                              <span>{t.description || "-"}</span>
                            </div>
                          ) : (
                            t.description || "-"
                          )}
                        </TableCell>
                        {role !== 'barber' && <TableCell>{t.barber?.name || "Geral"}</TableCell>}
                        <TableCell>
                          {t.appointment ? (
                            <Badge className={cn(
                              "font-semibold",
                              t.appointment.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                              t.appointment.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                              'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            )} variant="outline">
                              {t.appointment.status === 'completed' ? 'Concluído' : 
                               t.appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Manual</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {/* Prioritize manual/transaction payment method */}
                            {t.payment_method === 'misto' || t.payment_method === 'mixed' ? (
                              <Badge variant="outline" className="w-fit bg-orange-500/10 text-orange-500 border-orange-500/20 font-bold">MISTO</Badge>
                            ) : (
                              <>
                                {(t.payment_method === 'pix' || t.appointment?.payment_method === 'pix') && <Badge variant="outline" className="w-fit bg-emerald-500/10 text-emerald-500 border-emerald-500/20">PIX</Badge>}
                                {(t.payment_method === 'dinheiro' || t.appointment?.payment_method === 'cash') && <Badge variant="outline" className="w-fit bg-blue-500/10 text-blue-500 border-blue-500/20">Dinheiro</Badge>}
                                {(t.payment_method === 'credit_card' || t.payment_method === 'card' || t.appointment?.payment_method === 'card') && <Badge variant="outline" className="w-fit bg-purple-500/10 text-purple-500 border-purple-500/20">Cartão</Badge>}
                                {(t.payment_method === 'debit_card') && <Badge variant="outline" className="w-fit bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Débito</Badge>}
                                {(t.payment_method === 'credits' || t.appointment?.payment_method === 'credits') && <Badge variant="outline" className="w-fit bg-violet-500/10 text-violet-500 border-violet-500/20">Créditos</Badge>}
                                {(t.payment_method === 'cashback' || t.appointment?.payment_method === 'cashback') && <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20">Cashback</Badge>}
                              </>
                            )}
                            
                            {/* Detailed parts for Misto or Manual adjustments */}
                            {(t.pix_amount > 0) && <span className="text-[9px] text-emerald-400 font-medium">PIX: R$ {Number(t.pix_amount).toFixed(2)}</span>}
                            {(t.cash_amount > 0) && <span className="text-[9px] text-blue-400 font-medium">Din: R$ {Number(t.cash_amount).toFixed(2)}</span>}
                            {(t.credit_card_amount > 0) && <span className="text-[9px] text-purple-400 font-medium">CC: R$ {Number(t.credit_card_amount).toFixed(2)}</span>}
                            {(t.debit_card_amount > 0) && <span className="text-[9px] text-indigo-400 font-medium">Deb: R$ {Number(t.debit_card_amount).toFixed(2)}</span>}

                            {(t.appointment?.credit_used > 0 || t.appointment?.credits_used > 0 || t.credits_amount > 0) && (
                              <span className="text-[10px] text-purple-400 font-bold uppercase">Créditos: R$ {(Number(t.appointment?.credit_used || 0) + Number(t.appointment?.credits_used || 0) + Number(t.credits_amount || 0)).toFixed(2)}</span>
                            )}
                            {(t.appointment?.cashback_used > 0 || t.cashback_amount > 0) && (
                              <span className="text-[10px] text-orange-400 font-bold uppercase">Cashback: R$ {(Number(t.appointment?.cashback_used || 0) + Number(t.cashback_amount || 0)).toFixed(2)}</span>
                            )}
                            {!t.appointment && !t.payment_method && <span className="text-xs uppercase font-medium text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{t.category || "-"}</TableCell>
                        <TableCell className={cn("text-right font-bold", t.type === "income" ? (parseFloat(String(t.amount)) > 0 ? "text-emerald-500" : "text-violet-400") : "text-red-500")}>
                          {t.type === "income" ? (parseFloat(String(t.amount)) > 0 ? "+" : "★") : "-"} R$ {(() => {
                            const val = parseFloat(String(t.amount)) || 0;
                            if (val === 0 && (t.description?.includes("CRÉDITOS") || t.description?.includes("Créditos") || t.description?.includes("Uso de Crédito"))) {
                              const match = t.description.match(/R\$\s*([\d.]+)/);
                              return match ? parseFloat(match[1]).toFixed(2) : "0.00";
                            }
                            return val.toFixed(2);
                          })()}
                          {t.type === "income" && (parseFloat(String(t.amount)) || 0) === 0 && <span className="block text-[10px] opacity-70">Crédito</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setEditingTransaction({
                                  ...t,
                                  amount: String(t.amount || ""),
                                  barber_id: t.barber_id || "none",
                                  date: formatTransactionDateForEdit(t),
                                  time: formatTransactionTimeForEdit(t),
                                  payment_method: t.payment_method || (t.appointment?.payment_method === 'cash' ? 'dinheiro' : t.appointment?.payment_method) || "dinheiro",
                                  category: t.category || "Serviço",
                                  pix_amount: t.pix_amount || t.appointment?.pix_amount || 0,
                                  cash_amount: t.cash_amount || 0,
                                  credit_card_amount: t.credit_card_amount || 0,
                                  debit_card_amount: t.debit_card_amount || 0,
                                  credits_amount: t.credits_amount || t.appointment?.credits_used || t.appointment?.credit_used || 0,
                                  cashback_amount: t.cashback_amount || t.appointment?.cashback_used || 0,
                                  adjustment_reason: ""
                                });
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit2 size={14} />
                            </Button>

                            <Dialog open={isEditDialogOpen && editingTransaction?.id === t.id} onOpenChange={(open) => {
                              if (!open) {
                                setIsEditDialogOpen(false);
                                setEditingTransaction(null);
                              }
                            }}>
                               <DialogContent className="max-w-[95vw] sm:max-w-[650px] bg-[#0b0f17] border-amber-500/30 shadow-2xl shadow-amber-500/10 rounded-[24px] overflow-hidden p-0 text-white">
                                  <DialogHeader className="p-6 sm:p-8 border-b border-white/5">
                                    <DialogTitle className="text-2xl font-black text-white tracking-tight">Ajuste Manual de Transação</DialogTitle>
                                    <p className="text-xs text-zinc-400 font-medium">Realize ajustes financeiros manuais para correção de fluxos e registros.</p>
                                  </DialogHeader>
                                  {editingTransaction && (
                                    <form onSubmit={handleUpdateTransaction} className="space-y-6">
                                      <div className="p-6 sm:p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <div className="space-y-6">
                                            <div className="space-y-2">
                                              <Label htmlFor="edit-date" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data</Label>
                                              <Input 
                                                id="edit-date" 
                                                type="date"
                                                value={editingTransaction.date} 
                                                onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})} 
                                                required 
                                                className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label htmlFor="edit-time" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Horário</Label>
                                              <Input 
                                                id="edit-time" 
                                                type="time"
                                                value={editingTransaction.time} 
                                                onChange={(e) => setEditingTransaction({...editingTransaction, time: e.target.value})} 
                                                required 
                                                className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label htmlFor="edit-amount" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor Total (R$)</Label>
                                              <Input 
                                                id="edit-amount" 
                                                type="number"
                                                step="0.01"
                                                value={editingTransaction.amount} 
                                                onChange={(e) => setEditingTransaction({...editingTransaction, amount: e.target.value})} 
                                                required 
                                                className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl font-black text-lg"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label htmlFor="edit-type" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipo</Label>
                                              <Select 
                                                value={editingTransaction.type} 
                                                onValueChange={(val) => setEditingTransaction({...editingTransaction, type: val})}
                                              >
                                                <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                                                  <SelectItem value="income" className="focus:bg-amber-500/20 focus:text-white">Entrada (Receita)</SelectItem>
                                                  <SelectItem value="expense" className="focus:bg-amber-500/20 focus:text-white">Saída (Despesa)</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>

                                          <div className="space-y-6">
                                            <div className="space-y-2">
                                              <Label htmlFor="edit-payment-method" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Forma de Pagamento</Label>
                                              <Select 
                                                value={editingTransaction.payment_method} 
                                                onValueChange={(val) => setEditingTransaction({...editingTransaction, payment_method: val})}
                                              >
                                                <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                                                  <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                                                  <SelectItem value="pix" className="focus:bg-amber-500/20 focus:text-white">PIX</SelectItem>
                                                  <SelectItem value="dinheiro" className="focus:bg-amber-500/20 focus:text-white">Dinheiro</SelectItem>
                                                  <SelectItem value="credit_card" className="focus:bg-amber-500/20 focus:text-white">Cartão de Crédito</SelectItem>
                                                  <SelectItem value="debit_card" className="focus:bg-amber-500/20 focus:text-white">Cartão de Débito</SelectItem>
                                                  <SelectItem value="barbershop" className="focus:bg-amber-500/20 focus:text-white">Pagar na Barbearia</SelectItem>
                                                  <SelectItem value="credits" className="focus:bg-amber-500/20 focus:text-white">Créditos</SelectItem>
                                                  <SelectItem value="cashback" className="focus:bg-amber-500/20 focus:text-white">Cashback</SelectItem>
                                                  <SelectItem value="misto" className="focus:bg-amber-500/20 focus:text-white">Misto (Múltiplas Formas)</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>

                                            <div className="space-y-2">
                                              <Label htmlFor="edit-category-dropdown" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Categoria</Label>
                                              <Select 
                                                value={editingTransaction.category} 
                                                onValueChange={(val) => setEditingTransaction({...editingTransaction, category: val})}
                                              >
                                                <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                                                  <SelectItem value="Serviço" className="focus:bg-amber-500/20 focus:text-white">Serviço</SelectItem>
                                                  <SelectItem value="Produto" className="focus:bg-amber-500/20 focus:text-white">Produto</SelectItem>
                                                  <SelectItem value="Ambos" className="focus:bg-amber-500/20 focus:text-white">Ambos</SelectItem>
                                                  <SelectItem value="Outros" className="focus:bg-amber-500/20 focus:text-white">Outros</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>

                                            <div className="space-y-2">
                                              <Label htmlFor="edit-barber" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Barbeiro Responsável</Label>
                                              <Select 
                                                value={editingTransaction.barber_id} 
                                                onValueChange={(val) => setEditingTransaction({...editingTransaction, barber_id: val})}
                                              >
                                                <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                                                  <SelectItem value="none" className="focus:bg-amber-500/20 focus:text-white">Nenhum / Geral</SelectItem>
                                                  {barbers.map((b) => (
                                                    <SelectItem key={b.id} value={b.id} className="focus:bg-amber-500/20 focus:text-white">{b.name}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                        </div>

                                        {(editingTransaction.payment_method === 'misto' || editingTransaction.payment_method === 'mixed') && (
                                          <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/20 shadow-inner space-y-6">
                                            <div className="flex items-center gap-2">
                                              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                                              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">Detalhamento do Pagamento Misto</h4>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                              <div className="space-y-2">
                                                <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor PIX</Label>
                                                <Input type="number" step="0.01" value={editingTransaction.pix_amount} onChange={(e) => setEditingTransaction({...editingTransaction, pix_amount: e.target.value})} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                                              </div>
                                              <div className="space-y-2">
                                                <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Dinheiro</Label>
                                                <Input type="number" step="0.01" value={editingTransaction.cash_amount} onChange={(e) => setEditingTransaction({...editingTransaction, cash_amount: e.target.value})} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                                              </div>
                                              <div className="space-y-2">
                                                <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Crédito</Label>
                                                <Input type="number" step="0.01" value={editingTransaction.credit_card_amount} onChange={(e) => setEditingTransaction({...editingTransaction, credit_card_amount: e.target.value})} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                                              </div>
                                              <div className="space-y-2">
                                                <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Débito</Label>
                                                <Input type="number" step="0.01" value={editingTransaction.debit_card_amount} onChange={(e) => setEditingTransaction({...editingTransaction, debit_card_amount: e.target.value})} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                                              </div>
                                              <div className="space-y-2">
                                                <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Créditos</Label>
                                                <Input type="number" step="0.01" value={editingTransaction.credits_amount} onChange={(e) => setEditingTransaction({...editingTransaction, credits_amount: e.target.value})} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                                              </div>
                                              <div className="space-y-2">
                                                <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Cashback</Label>
                                                <Input type="number" step="0.01" value={editingTransaction.cashback_amount} onChange={(e) => setEditingTransaction({...editingTransaction, cashback_amount: e.target.value})} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                                              </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                              <div className={cn(
                                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                                                Math.abs((Number(editingTransaction.pix_amount || 0) + Number(editingTransaction.cash_amount || 0) + Number(editingTransaction.credit_card_amount || 0) + Number(editingTransaction.debit_card_amount || 0) + Number(editingTransaction.credits_amount || 0) + Number(editingTransaction.cashback_amount || 0)) - parseFloat(editingTransaction.amount)) < 0.01 
                                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                                  : "bg-red-500/10 text-red-500 border-red-500/20"
                                              )}>
                                                Soma: R$ {(Number(editingTransaction.pix_amount || 0) + Number(editingTransaction.cash_amount || 0) + Number(editingTransaction.credit_card_amount || 0) + Number(editingTransaction.debit_card_amount || 0) + Number(editingTransaction.credits_amount || 0) + Number(editingTransaction.cashback_amount || 0)).toFixed(2)}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        <div className="space-y-6">
                                          <div className="space-y-2">
                                            <Label htmlFor="edit-description" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Descrição Pública (Exibida na Tabela)</Label>
                                            <Input 
                                              id="edit-description" 
                                              value={editingTransaction.description} 
                                              onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})} 
                                              className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl"
                                            />
                                          </div>

                                          <div className="space-y-2">
                                            <Label htmlFor="edit-internal-notes" className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Observações Internas</Label>
                                            <Textarea 
                                              id="edit-internal-notes" 
                                              value={editingTransaction.notes || ""} 
                                              onChange={(e) => setEditingTransaction({...editingTransaction, notes: e.target.value})} 
                                              placeholder="Anotações que não aparecem para o cliente..."
                                              className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all rounded-xl min-h-[100px] resize-none text-sm placeholder:text-zinc-600"
                                            />
                                          </div>

                                          <div className="space-y-2">
                                            <Label htmlFor="edit-reason" className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                                              Motivo do Ajuste <span className="text-[8px] text-red-500/60 font-medium">(Obrigatório)</span>
                                            </Label>
                                            <Input 
                                              id="edit-reason" 
                                              value={editingTransaction.adjustment_reason} 
                                              onChange={(e) => setEditingTransaction({...editingTransaction, adjustment_reason: e.target.value})} 
                                              placeholder="Ex: Erro no lançamento original, Cliente mudou forma de pagamento..."
                                              required
                                              className="bg-[#05070d] border-red-500/20 focus:border-red-500 text-white transition-all h-11 rounded-xl text-sm placeholder:text-zinc-600"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <DialogFooter className="p-6 sm:p-8 bg-[#05070d]/50 border-t border-white/5 flex flex-col sm:flex-row gap-3">
                                        <Button 
                                          type="button" 
                                          variant="ghost" 
                                          onClick={() => setIsEditDialogOpen(false)}
                                          className="flex-1 sm:flex-none h-12 rounded-xl border border-zinc-800 text-zinc-400 font-bold hover:bg-zinc-800 hover:text-white transition-all order-2 sm:order-1"
                                        >
                                          Cancelar
                                        </Button>
                                        <Button 
                                          type="submit" 
                                          className="flex-1 sm:flex-none h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black px-10 shadow-lg shadow-amber-500/20 transition-all active:scale-95 order-1 sm:order-2"
                                        >
                                          Salvar Alterações
                                        </Button>
                                      </DialogFooter>
                                    </form>
                                  )}
                                </DialogContent>
                              </Dialog>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                                onClick={() => {
                                  setSelectedAppointmentId(t.appointment_id);
                                  setIsDetailsModalOpen(true);
                                }}
                              >
                                Detalhes
                              </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTransaction(t.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground italic">
                    Nenhuma transação encontrada.
                  </div>
                ) : (
                  filteredTransactions.map((t) => (
                    <div 
                      key={t.id} 
                      className="p-4 space-y-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedAppointmentId(t.appointment_id);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {t.appointment?.start_time 
                              ? new Date(t.appointment.start_time).toLocaleDateString('pt-BR')
                              : (t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR') : "-")}
                          </span>
                          <span className="text-lg font-black text-foreground">
                            {t.appointment?.start_time 
                              ? format(new Date(t.appointment.start_time), 'HH:mm')
                              : (typeof t.time === 'string' ? t.time.substring(0, 5) : "--:--")}
                          </span>
                        </div>
                        <div className={cn("text-right", t.type === "income" ? (parseFloat(String(t.amount)) > 0 ? "text-emerald-500" : "text-violet-400") : "text-red-500")}>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">{t.type === "income" ? "Entrada" : "Saída"}</p>
                          <span className="text-lg font-black italic">
                             R$ {(() => {
                              const val = parseFloat(String(t.amount)) || 0;
                              if (val === 0 && (t.description?.includes("CRÉDITOS") || t.description?.includes("Créditos") || t.description?.includes("Uso de Crédito"))) {
                                const match = t.description.match(/R\$\s*([\d.]+)/);
                                return match ? parseFloat(match[1]).toFixed(2) : "0.00";
                              }
                              return val.toFixed(2);
                            })()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-background/50 p-3 rounded-xl border border-border">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Descrição</p>
                          <p className="text-sm font-bold text-foreground leading-tight">
                            {t.appointment?.customers?.name ? (
                              <>
                                <span className="text-primary">Cliente: {t.appointment.customers.name}</span><br/>
                                {t.description || "-"}
                              </>
                            ) : (
                              t.description || "-"
                            )}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                           <div className="bg-background/50 p-3 rounded-xl border border-border">
                             <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status</p>
                             {t.appointment ? (
                               <Badge className={cn(
                                 "text-[10px] font-black uppercase italic",
                                 t.appointment.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                 t.appointment.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                               )} variant="outline">
                                 {t.appointment.status === 'completed' ? 'Concluído' : 
                                  t.appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                               </Badge>
                             ) : (
                               <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] font-black uppercase italic">Manual</Badge>
                             )}
                           </div>
                           <div className="bg-background/50 p-3 rounded-xl border border-border">
                             <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Pagamento</p>
                             <div className="flex flex-wrap gap-1">
                               {t.payment_method === 'misto' ? (
                                 <Badge variant="outline" className="text-[10px] font-bold bg-orange-500/10 text-orange-500 border-orange-500/20">MISTO</Badge>
                               ) : (
                                 <>
                                   {(t.payment_method === 'pix' || t.appointment?.payment_method === 'pix') && <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/20">PIX</Badge>}
                                   {(t.payment_method === 'dinheiro' || t.appointment?.payment_method === 'cash') && <Badge variant="outline" className="text-[10px] font-bold bg-blue-500/10 text-blue-500 border-blue-500/20">Dinheiro</Badge>}
                                   {(t.payment_method === 'credit_card' || t.payment_method === 'card' || t.appointment?.payment_method === 'card') && <Badge variant="outline" className="text-[10px] font-bold bg-purple-500/10 text-purple-500 border-purple-500/20">Cartão</Badge>}
                                   {(t.payment_method === 'debit_card') && <Badge variant="outline" className="text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Débito</Badge>}
                                   {(t.payment_method === 'credits' || t.appointment?.payment_method === 'credits') && <Badge variant="outline" className="text-[10px] font-bold bg-violet-500/10 text-violet-500 border-violet-500/20">Créditos</Badge>}
                                   {(t.payment_method === 'cashback' || t.appointment?.payment_method === 'cashback') && <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">Cashback</Badge>}
                                 </>
                               )}
                             </div>
                             <div className="mt-1 flex flex-col gap-0.5">
                               {(t.pix_amount > 0) && <span className="text-[9px] text-emerald-400 font-medium">PIX: R$ {Number(t.pix_amount).toFixed(2)}</span>}
                               {(t.cash_amount > 0) && <span className="text-[9px] text-blue-400 font-medium">Din: R$ {Number(t.cash_amount).toFixed(2)}</span>}
                               {(t.appointment?.credits_used > 0 || t.credits_amount > 0) && <span className="text-[9px] text-purple-400 font-medium">Cred: R$ {(Number(t.appointment?.credits_used || 0) + Number(t.credits_amount || 0)).toFixed(2)}</span>}
                               {(t.appointment?.cashback_used > 0 || t.cashback_amount > 0) && <span className="text-[9px] text-orange-400 font-medium">Cash: R$ {(Number(t.appointment?.cashback_used || 0) + Number(t.cashback_amount || 0)).toFixed(2)}</span>}
                             </div>
                           </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-9 w-auto text-xs gap-1 font-bold rounded-xl border-border bg-background hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTransaction({
                              ...t,
                              amount: String(t.amount || ""),
                              barber_id: t.barber_id || "none",
                              date: formatTransactionDateForEdit(t),
                              time: formatTransactionTimeForEdit(t),
                              payment_method: t.payment_method || (t.appointment?.payment_method === 'cash' ? 'dinheiro' : t.appointment?.payment_method) || "dinheiro",
                              category: t.category || "Serviço",
                              pix_amount: t.pix_amount || t.appointment?.pix_amount || 0,
                              cash_amount: t.cash_amount || 0,
                              credit_card_amount: t.credit_card_amount || 0,
                              debit_card_amount: t.debit_card_amount || 0,
                              credits_amount: t.credits_amount || t.appointment?.credits_used || t.appointment?.credit_used || 0,
                              cashback_amount: t.cashback_amount || t.appointment?.cashback_used || 0,
                              adjustment_reason: ""
                            });
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit2 size={12} /> Editar
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-auto text-xs gap-1 font-bold rounded-xl text-red-500 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTransaction(t.id);
                          }}
                        >
                          <Trash2 size={12} /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pending" className="pt-4">
            <div className="border border-border rounded-xl bg-card text-foreground overflow-x-auto custom-scrollbar shadow-sm">
              <Table className="min-w-[800px] md:min-w-0">
                <TableHeader className="bg-background">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="w-[100px] text-muted-foreground">Data</TableHead>
                    <TableHead className="w-[100px] text-muted-foreground">Hora</TableHead>
                    <TableHead className="text-muted-foreground">Cliente</TableHead>
                    <TableHead className="text-muted-foreground">Serviço</TableHead>
                    {role !== 'barber' && <TableHead className="text-muted-foreground">Barbeiro</TableHead>}
                    <TableHead className="text-right text-muted-foreground">Valor</TableHead>
                    <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={role !== 'barber' ? 7 : 6} className="text-center py-8 text-muted-foreground">
                        Nenhum agendamento pendente de pagamento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    appointments.map((app) => (
                      <TableRow key={app.id} className="border-border hover:bg-muted/50 transition-colors">
                        <TableCell className="whitespace-nowrap text-foreground">
                          {new Date(app.start_time).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">{new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{app.customers?.name || "Cliente"}</TableCell>
                        <TableCell className="text-muted-foreground">{app.services?.name || "Serviço"}</TableCell>
                        {role !== 'barber' && <TableCell>{app.barber?.name || "Geral"}</TableCell>}
                        <TableCell className="text-right font-bold text-yellow-500">
                          R$ {(parseFloat(String(app.total_price)) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => {
                                setSelectedAppointmentId(app.id);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <Check size={14} /> Confirmar / Detalhes
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={async () => {
                                if (!confirm("Deseja cancelar este agendamento? O valor será registrado como saída se houver custo associado.")) return;
                                
                                const { error } = await supabase
                                  .from("appointments")
                                  .update({ status: 'cancelled' })
                                  .eq("id", app.id);
                                
                                if (error) {
                                  toast.error("Erro ao cancelar agendamento");
                                } else {
                                  // Se o usuário quiser registrar como saída, poderia haver um campo de custo, 
                                  // mas conforme solicitado "se for cancelado vai para saida" 
                                  // (assumindo o valor total como perda/saída se aplicável, ou apenas movendo lógica)
                                  await supabase.from("transactions").insert({
                                    amount: app.total_price,
                                    type: "expense",
                                    description: `Cancelamento: ${app.services?.name} - ${app.customers?.name}`,
                                    category: "Cancelamento",
                                    barber_id: app.barber_id,
                                    appointment_id: app.id,
                                    user_id: user.id,
                                    date: new Date().toISOString().split('T')[0]
                                  });

                                  toast.success("Agendamento cancelado e registrado como saída!");
                                  fetchAppointments();
                                  fetchTransactions();
                                }
                              }}
                            >
                              <X size={14} /> Cancelar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="barbers" className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-4 items-end bg-card p-4 border border-border rounded-xl text-foreground">
              <div className="space-y-2">
                <Label htmlFor="barber-filter-date">Filtrar por Data</Label>
                <input 
                  id="barber-filter-date" 
                  type="date" 
                  className="flex h-10 w-[180px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  value={barberDateFilter}
                  onChange={(e) => setBarberDateFilter(e.target.value)}
                />
              </div>
              <Button 
                variant="ghost" 
                onClick={() => setBarberDateFilter("")}
                className="h-10 hover:bg-accent hover:text-accent-foreground"
              >
                Todas as Datas
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {barbers.map((barber) => {
                const barberTransactions = transactions.filter(t => 
                  t.barber_id === barber.id && 
                  t.type === 'income' &&
                  (!barberDateFilter || t.date === barberDateFilter)
                );
                const totalReceived = barberTransactions.reduce((acc, t) => {
                  // Se houver agendamento vinculado, usamos o valor total para receita operacional do barbeiro
                  if (t.appointment) {
                    return acc + (Number(t.appointment.original_total || t.appointment.total_price || (Number(t.amount) + Number(t.appointment.credit_used || 0))) || 0);
                  }
                  
                  const val = parseFloat(String(t.amount)) || 0;
                  // Tenta extrair créditos da descrição se o valor for 0 (legado ou manual)
                  if (val === 0 && (t.description?.includes("CRÉDITOS") || t.description?.includes("Créditos") || t.description?.includes("Uso de Crédito") || t.description?.includes("Abatimento"))) {
                    const match = t.description.match(/R\$\s*([\d.]+)/);
                    if (match) return acc + parseFloat(match[1]);
                  }
                  
                  // Verifica se tem texto de abatimento mas o valor não é 0
                  if (t.description?.includes("Abatimento Créditos: R$")) {
                    const match = t.description?.match(/Abatimento Créditos: R\$\s*([\d.]+)/);
                    const creditedAmount = match ? parseFloat(match[1]) : 0;
                    return acc + val + creditedAmount;
                  }
                  
                  return acc + val;
                }, 0);
                
                const commissionRate = Number(barber.commission_rate || 0);
                const barberPart = totalReceived * (commissionRate / 100);
                const barbershopPartFromBarber = totalReceived - barberPart;

                return (
                  <Card key={barber.id} className="bg-card border-border text-foreground">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-white">{barber.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Comissão: {commissionRate}%</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center border-b border-border pb-2">
                        <span className="text-sm text-muted-foreground">Total Atendido</span>
                        <span className="font-bold text-white">R$ {totalReceived.toFixed(2)}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span>Parte do Barbeiro ({commissionRate}%)</span>
                          <span className="text-emerald-500 font-medium">R$ {barberPart.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span>Parte da Barbearia</span>
                          <span className="text-primary font-medium">R$ {barbershopPartFromBarber.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              <Card className="bg-card border-primary/20 text-foreground shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white font-black">Barbearia Geral (Total)</CardTitle>
                  <p className="text-xs text-muted-foreground">Soma de todos os ganhos da barbearia</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(() => {
                      const generalTransactions = transactions.filter(t => 
                        !t.barber_id && 
                        t.type === 'income' &&
                        (!barberDateFilter || t.date === barberDateFilter)
                      );
                      const totalGeneralOnly = generalTransactions.reduce((acc, t) => {
                        // Para lançamentos gerais (sem barbeiro), usamos o valor da transação + créditos se houver
                        const val = parseFloat(String(t.amount)) || 0;
                        if (val === 0 && (t.description?.includes("CRÉDITOS") || t.description?.includes("Créditos") || t.description?.includes("Uso de Crédito") || t.description?.includes("Abatimento"))) {
                          const match = t.description.match(/R\$\s*([\d.]+)/);
                          if (match) return acc + parseFloat(match[1]);
                        }
                        if (t.description?.includes("Abatimento Créditos: R$")) {
                          const match = t.description?.match(/Abatimento Créditos: R\$\s*([\d.]+)/);
                          const creditedAmount = match ? parseFloat(match[1]) : 0;
                          return acc + val + creditedAmount;
                        }
                        return acc + val;
                      }, 0);

                      const totalFromBarbers = barbers.reduce((acc, barber) => {
                        const bTransactions = transactions.filter(t => 
                          t.barber_id === barber.id && 
                          t.type === 'income' &&
                          (!barberDateFilter || t.date === barberDateFilter)
                        );
                        const bTotal = bTransactions.reduce((tAcc, t) => {
                          if (t.appointment) {
                            return tAcc + (Number(t.appointment.original_total || t.appointment.total_price || (Number(t.amount) + Number(t.appointment.credit_used || 0))) || 0);
                          }
                          const val = parseFloat(String(t.amount)) || 0;
                          if (val === 0 && (t.description?.includes("CRÉDITOS") || t.description?.includes("Créditos") || t.description?.includes("Uso de Crédito") || t.description?.includes("Abatimento"))) {
                            const match = t.description.match(/R\$\s*([\d.]+)/);
                            if (match) return tAcc + parseFloat(match[1]);
                          }
                          if (t.description?.includes("Abatimento Créditos: R$")) {
                            const match = t.description?.match(/Abatimento Créditos: R\$\s*([\d.]+)/);
                            const creditedAmount = match ? parseFloat(match[1]) : 0;
                            return tAcc + val + creditedAmount;
                          }
                          return tAcc + val;
                        }, 0);
                        const commissionRate = Number(barber.commission_rate || 0);
                        return acc + (bTotal - (bTotal * (commissionRate / 100)));
                      }, 0);

                      const finalTotal = totalGeneralOnly + totalFromBarbers;

                      return (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Lançamentos Gerais</span>
                            <span className="text-foreground">R$ {totalGeneralOnly.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Vindo dos Barbeiros</span>
                            <span className="text-foreground">R$ {totalFromBarbers.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-border pt-2 mt-2">
                             <span className="font-bold text-white uppercase tracking-tighter">Total Acumulado</span>
                            <span className="text-xl font-black text-primary">R$ {finalTotal.toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}
                </CardContent>
              </Card>

              {barbers.length === 0 && (
                <div className="col-span-full text-center py-12 border border-border rounded-xl bg-card text-foreground font-medium">
                  Nenhum barbeiro cadastrado.
                </div>
              )}
            </div>
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
