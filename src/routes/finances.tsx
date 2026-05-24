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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, Calendar, Plus, TrendingUp, TrendingDown, Wallet, Edit2, Trash2, Clock, Check, X, Scissors, CircleDollarSign } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [newTransaction, setNewTransaction] = useState({ amount: "", type: "income", description: "", category: "Serviço", barber_id: "none", date: new Date().toISOString().split('T')[0], time: "12:00" });
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [barberDateFilter, setBarberDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  
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
        appointment:appointments(status, payment_method, credit_used, original_total, final_amount, total_price, start_time, customers(name))
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
      !t.appointment || t.appointment.status === 'completed'
    );

    // 1. Receita Operacional (Faturamento Operacional) - Valor Total dos Serviços Vendidos
    const operationalRevenue = effectiveTransactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => {
        if (t.appointment) {
          return acc + (Number(t.appointment.original_total || t.appointment.total_price || (Number(t.amount) + Number(t.appointment.credit_used || 0))) || 0);
        }

        const val = parseFloat(String(t.amount)) || 0;
        
        let creditedAmount = 0;
        if (t.description?.includes("Abatimento Créditos: R$")) {
          const match = t.description?.match(/Abatimento Créditos: R\$\s*([\d.]+)/);
          creditedAmount = match ? parseFloat(match[1]) : 0;
        } else if (t.description?.includes("Créditos: R$")) {
          const match = t.description?.match(/Créditos: R\$\s*([\d.]+)/);
          creditedAmount = match ? parseFloat(match[1]) : 0;
        }
        
        return acc + val + creditedAmount;
      }, 0);

    // 2. Fluxo de Caixa (Entrada Financeira Real) - Dinheiro novo no caixa
    const realCashIncome = effectiveTransactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => acc + (parseFloat(String(t.amount)) || 0), 0);

    // 3. Créditos Consumidos
    const creditsConsumed = effectiveTransactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => {
        let creditedAmount = 0;
        if (t.appointment?.credit_used) {
          creditedAmount = Number(t.appointment.credit_used);
        } else if (t.description?.includes("Abatimento Créditos: R$")) {
          const match = t.description?.match(/Abatimento Créditos: R\$\s*([\d.]+)/);
          creditedAmount = match ? parseFloat(match[1]) : 0;
        }
        return acc + creditedAmount;
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
        
        if (t.description?.includes("Abatimento Créditos: R$")) {
          const match = t.description?.match(/Abatimento Créditos: R\$\s*([\d.]+)/);
          creditedAmount = match ? parseFloat(match[1]) : 0;
        }
        if (t.description?.includes("Abatimento Cashback: R$")) {
          const match = t.description?.match(/Abatimento Cashback: R\$\s*([\d.]+)/);
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
      setNewTransaction({ amount: "", type: "income", description: "", category: "Serviço", barber_id: "none", date: new Date().toISOString().split('T')[0], time: "12:00" });
      fetchTransactions();
    }
  }

  async function handleUpdateTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !editingTransaction) return;

    const { error } = await supabase
      .from("transactions")
      .update({
        amount: parseFloat(editingTransaction.amount),
        type: editingTransaction.type,
        description: editingTransaction.description,
        category: editingTransaction.category,
        barber_id: editingTransaction.barber_id === "none" ? null : editingTransaction.barber_id,
        date: editingTransaction.date,
        time: editingTransaction.time,
      })
      .eq("id", editingTransaction.id);

    if (error) {
      toast.error("Erro ao atualizar transação");
    } else {
      toast.success("Transação atualizada!");
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      fetchTransactions();
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Financeiro</h2>
            <p className="text-muted-foreground">Controle suas entradas e saídas.</p>
          </div>
          <div className="flex items-center gap-2">
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
                <Button type="submit" className="w-full">Salvar</Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className={cn(
          "grid gap-4",
          role === 'barber' ? "md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
        )}>
          <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-black">Faturamento Operacional</CardTitle>
              <div className="p-2 bg-blue-200/50 rounded-lg">
                <Scissors className="h-4 w-4 text-blue-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">R$ {summary.income.toFixed(2)}</div>
              <p className="text-[10px] text-blue-700 font-medium mt-1">Total de serviços vendidos</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-green-800">Fluxo de Caixa</CardTitle>
              <div className="p-2 bg-green-200/50 rounded-lg">
                <CircleDollarSign className="h-4 w-4 text-green-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">R$ {summary.realCashIncome.toFixed(2)}</div>
              <p className="text-[10px] text-green-700 font-medium mt-1">Dinheiro novo recebido</p>
            </CardContent>
          </Card>

          {role !== 'barber' && (
            <>
              <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-purple-800">Créditos Consumidos</CardTitle>
                  <div className="p-2 bg-purple-200/50 rounded-lg">
                    <Wallet className="h-4 w-4 text-purple-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">R$ {summary.creditsConsumed.toFixed(2)}</div>
                  <p className="text-[10px] text-purple-700 font-medium mt-1">Abatido via créditos</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-red-800">Saídas</CardTitle>
                  <div className="p-2 bg-red-200/50 rounded-lg">
                    <TrendingDown className="h-4 w-4 text-red-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-900">R$ {summary.expense.toFixed(2)}</div>
                  <p className="text-[10px] text-red-700 font-medium mt-1">Despesas e estornos</p>
                </CardContent>
              </Card>
            </>
          )}

          <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-indigo-800">{role === 'barber' ? 'Minha Comissão' : 'Freelancers'}</CardTitle>
              <div className="p-2 bg-indigo-200/50 rounded-lg">
                <Users className="h-4 w-4 text-indigo-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-900">R$ {summary.freelancersPart.toFixed(2)}</div>
              <p className="text-[10px] text-indigo-700 font-medium mt-1">{role === 'barber' ? 'Minha parte garantida' : 'Comissões (Total serviços)'}</p>
            </CardContent>
          </Card>

          {role !== 'barber' && (
            <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-emerald-800">Barbearia</CardTitle>
                <div className="p-2 bg-emerald-200/50 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-900">R$ {summary.barbershopPart.toFixed(2)}</div>
                <p className="text-[10px] text-emerald-700 font-medium mt-1">Receita operacional líquida</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-yellow-800">Pendente</CardTitle>
              <div className="p-2 bg-yellow-200/50 rounded-lg">
                <Clock className="h-4 w-4 text-yellow-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900">R$ {summary.pending.toFixed(2)}</div>
              <p className="text-[10px] text-yellow-700 font-medium mt-1">Aguardando pagamento</p>
            </CardContent>
          </Card>

          {role !== 'barber' && (
            <Card className="bg-white border-2 border-slate-200 text-black shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-orange-800">Saldo Atual</CardTitle>
                <div className="p-2 bg-orange-200/50 rounded-lg">
                  <CircleDollarSign className="h-4 w-4 text-orange-700" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">R$ {summary.balance.toFixed(2)}</div>
                <p className="text-[10px] text-orange-700 font-medium mt-1">Real em caixa (Entrada - Saída)</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px] bg-white border border-slate-200 text-black">
            <TabsTrigger value="transactions" className="gap-2">
              <FileText size={16} /> Lançamentos
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock size={16} /> Pendentes
            </TabsTrigger>
            {role !== 'barber' && (
              <TabsTrigger value="barbers" className="gap-2">
                <Users size={16} /> Por Barbeiro
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="transactions" className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-4 items-end bg-card p-4 border rounded-xl">
              <div className="space-y-2">
                <Label htmlFor="filter-status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="filter-status" className="w-[180px]">
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
                  className="w-[180px]" 
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
                className="h-10"
              >
                Limpar Filtros
              </Button>
            </div>

            <div className="border rounded-xl bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead className="w-[100px]">Hora</TableHead>
                    <TableHead>Descrição</TableHead>
                    {role !== 'barber' && <TableHead>Barbeiro</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap">
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
                              t.appointment.status === 'completed' ? 'bg-emerald-600 text-white' : 
                              t.appointment.status === 'cancelled' ? 'bg-destructive text-white' : 
                              'bg-blue-100 text-blue-700'
                            )} variant="outline">
                              {t.appointment.status === 'completed' ? 'Concluído' : 
                               t.appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100">Manual</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium uppercase">
                            {t.appointment?.payment_method === 'pix' ? 'PIX' : 
                             t.appointment?.payment_method === 'credits' ? 'Créditos' : 
                             t.appointment?.payment_method === 'cashback' ? 'Cashback' : 
                             t.appointment?.payment_method || '-'}
                          </span>
                        </TableCell>
                        <TableCell>{t.category || "-"}</TableCell>
                        <TableCell className={cn("text-right font-bold", t.type === "income" ? (parseFloat(String(t.amount)) > 0 ? "text-green-600" : "text-purple-600") : "text-red-600")}>
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
                            <Dialog open={isEditDialogOpen && editingTransaction?.id === t.id} onOpenChange={(open) => {
                              if (!open) {
                                setIsEditDialogOpen(false);
                                setEditingTransaction(null);
                              }
                            }}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setEditingTransaction({
                                    ...t,
                                    amount: String(t.amount || ""),
                                    barber_id: t.barber_id || "none",
                                    date: t.date,
                                    time: t.time || "12:00:00"
                                  });
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit2 size={14} />
                              </Button>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Transação</DialogTitle>
                                </DialogHeader>
                                {editingTransaction && (
                                  <form onSubmit={handleUpdateTransaction} className="space-y-4 pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-date">Data</Label>
                                        <Input 
                                          id="edit-date" 
                                          type="date"
                                          value={editingTransaction.date} 
                                          onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})} 
                                          required 
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-time">Horário</Label>
                                        <Input 
                                          id="edit-time" 
                                          type="time"
                                          value={editingTransaction.time} 
                                          onChange={(e) => setEditingTransaction({...editingTransaction, time: e.target.value})} 
                                          required 
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-amount">Valor (R$)</Label>
                                      <Input 
                                        id="edit-amount" 
                                        type="number"
                                        step="0.01"
                                        value={editingTransaction.amount} 
                                        onChange={(e) => setEditingTransaction({...editingTransaction, amount: e.target.value})} 
                                        required 
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-type">Tipo</Label>
                                      <Select 
                                        value={editingTransaction.type} 
                                        onValueChange={(val) => setEditingTransaction({...editingTransaction, type: val})}
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
                                      <Label htmlFor="edit-category">Categoria</Label>
                                      <Input 
                                        id="edit-category" 
                                        value={editingTransaction.category} 
                                        onChange={(e) => setEditingTransaction({...editingTransaction, category: e.target.value})} 
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-barber">Barbeiro</Label>
                                      <Select 
                                        value={editingTransaction.barber_id} 
                                        onValueChange={(val) => setEditingTransaction({...editingTransaction, barber_id: val})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
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
                                      <Label htmlFor="edit-description">Descrição</Label>
                                      <Input 
                                        id="edit-description" 
                                        value={editingTransaction.description} 
                                        onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})} 
                                      />
                                    </div>
                                    <Button type="submit" className="w-full">Atualizar</Button>
                                  </form>
                                )}
                              </DialogContent>
                            </Dialog>
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
          </TabsContent>

          <TabsContent value="pending" className="pt-4">
            <div className="border rounded-xl bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead className="w-[100px]">Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    {role !== 'barber' && <TableHead>Barbeiro</TableHead>}
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum agendamento pendente de pagamento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    appointments.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(app.start_time).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </TableCell>
                        <TableCell className="font-medium">{app.customers?.name || "Cliente"}</TableCell>
                        <TableCell>{app.services?.name || "Serviço"}</TableCell>
                        {role !== 'barber' && <TableCell>{app.barber?.name || "Geral"}</TableCell>}
                        <TableCell className="text-right font-bold text-yellow-600">
                          R$ {(parseFloat(String(app.total_price)) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("appointments")
                                  .update({ payment_status: 'paid', status: 'completed' })
                                  .eq("id", app.id);
                                
                                if (error) {
                                  toast.error("Erro ao confirmar pagamento");
                                } else {
                                  // Inserir na tabela de transações como Entrada
                                  await supabase.from("transactions").insert({
                                    amount: app.total_price,
                                    type: "income",
                                    description: `Atendimento: ${app.services?.name} - ${app.customers?.name}`,
                                    category: "Serviço",
                                    barber_id: app.barber_id,
                                    appointment_id: app.id,
                                    user_id: user.id,
                                    date: new Date().toISOString().split('T')[0]
                                  });
                                  
                                  toast.success("Pagamento confirmado e registrado!");
                                  fetchAppointments();
                                  fetchTransactions();
                                }
                              }}
                            >
                              <Check size={14} /> Confirmar
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
            <div className="flex flex-wrap gap-4 items-end bg-card p-4 border rounded-xl">
              <div className="space-y-2">
                <Label htmlFor="barber-filter-date">Filtrar por Data</Label>
                <input 
                  id="barber-filter-date" 
                  type="date" 
                  className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={barberDateFilter}
                  onChange={(e) => setBarberDateFilter(e.target.value)}
                />
              </div>
              <Button 
                variant="ghost" 
                onClick={() => setBarberDateFilter("")}
                className="h-10"
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
                  <Card key={barber.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{barber.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Comissão: {commissionRate}%</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-sm text-muted-foreground">Total Atendido</span>
                        <span className="font-bold">R$ {totalReceived.toFixed(2)}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span>Parte do Barbeiro ({commissionRate}%)</span>
                          <span className="text-green-600 font-medium">R$ {barberPart.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span>Parte da Barbearia</span>
                          <span className="text-blue-600 font-medium">R$ {barbershopPartFromBarber.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-primary">Barbearia Geral (Total)</CardTitle>
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
                            <span>R$ {totalGeneralOnly.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Vindo dos Barbeiros</span>
                            <span>R$ {totalFromBarbers.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center border-t pt-2 mt-2">
                            <span className="font-bold text-primary">Total Acumulado</span>
                            <span className="text-xl font-bold text-primary">R$ {finalTotal.toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}
                </CardContent>
              </Card>

              {barbers.length === 0 && (
                <div className="col-span-full text-center py-12 border rounded-xl bg-card text-muted-foreground">
                  Nenhum barbeiro cadastrado.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
