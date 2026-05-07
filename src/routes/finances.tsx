import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
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
import { Users, FileText, Calendar, Plus, TrendingUp, TrendingDown, Wallet, Edit2, Trash2 } from "lucide-react";
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { plan } = usePlanLimits();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ amount: "", type: "income", description: "", category: "Serviço", barber_id: "none", date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit' }) });
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  // Filtros
  const [filterDay, setFilterDay] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchBarbers();
    }
  }, [user]);

  async function fetchBarbers() {
    try {
      const { data, error } = await supabase
        .from("barbers")
        .select("id, name, commission_rate")
        .eq("active", true);
      
      if (error) {
        console.error("Error fetching barbers:", error);
        toast.error("Erro ao buscar barbeiros");
        return;
      }

      setBarbers(data || []);
    } catch (e) {
      console.error("Exception fetching barbers:", e);
    }
  }

  async function fetchTransactions() {
    if (fetching) return;
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          barber:barbers(name)
        `)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      
      if (error) {
        console.error("Error fetching transactions:", error);
        toast.error("Erro ao buscar transações");
        return;
      }

      setTransactions(data || []);
    } catch (e) {
      console.error("Exception fetching transactions:", e);
      setTransactions([]);
    } finally {
      setFetching(false);
    }
  }

  const summary = useMemo(() => {
    try {
      if (!transactions || !Array.isArray(transactions)) {
        return { income: 0, expense: 0, balance: 0 };
      }

      let income = 0;
      let expense = 0;

      transactions.forEach(t => {
        if (!t) return;
        
        let matchDay = true;
        let matchMonth = true;

        if (filterDay && t.date) {
          const parts = String(t.date).split('-');
          if (parts.length >= 3) {
            const day = parseInt(parts[2], 10);
            matchDay = day.toString() === filterDay;
          } else {
            matchDay = false;
          }
        }

        if (filterMonth && t.date) {
          const parts = String(t.date).split('-');
          if (parts.length >= 2) {
            const month = parseInt(parts[1], 10);
            matchMonth = month.toString() === filterMonth;
          } else {
            matchMonth = false;
          }
        }

        if (matchDay && matchMonth) {
          const amount = parseFloat(String(t.amount)) || 0;
          if (t.type === "income") {
            income += amount;
          } else if (t.type === "expense") {
            expense += amount;
          }
        }
      });

      return { income, expense, balance: income - expense };
    } catch (e) {
      console.error("Error in summary calculation:", e);
      return { income: 0, expense: 0, balance: 0 };
    }
  }, [transactions, filterDay, filterMonth]);

  const filteredTransactions = useMemo(() => {
    try {
      if (!transactions || !Array.isArray(transactions)) return [];

      return transactions.filter(t => {
        if (!t) return false;
        
        let matchDay = true;
        let matchMonth = true;

        if (filterDay && t.date) {
          const parts = String(t.date).split('-');
          if (parts.length >= 3) {
            const day = parseInt(parts[2], 10);
            matchDay = day.toString() === filterDay;
          } else {
            matchDay = false;
          }
        }

        if (filterMonth && t.date) {
          const parts = String(t.date).split('-');
          if (parts.length >= 2) {
            const month = parseInt(parts[1], 10);
            matchMonth = month.toString() === filterMonth;
          } else {
            matchMonth = false;
          }
        }

        return matchDay && matchMonth;
      });
    } catch (e) {
      console.error("Error in filtering transactions:", e);
      return [];
    }
  }, [transactions, filterDay, filterMonth]);

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
      setNewTransaction({ 
        amount: "", 
        type: "income", 
        description: "", 
        category: "Serviço", 
        barber_id: "none",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit' })
      });
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Financeiro</h2>
            <p className="text-muted-foreground">Controle suas entradas e saídas.</p>
          </div>
          <div className="flex items-center gap-2">
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

        <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtrar por:</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterDay} onValueChange={setFilterDay}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Dia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {Array.from({ length: 31 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {[
                  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                ].map((month, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterDay || filterMonth) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setFilterDay("");
                  setFilterMonth("");
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-green-50/50 border-green-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Entradas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">R$ {summary.income.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50/50 border-red-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700">Saídas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">R$ {summary.expense.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50/50 border-blue-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Saldo Atual</CardTitle>
              <Wallet className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", summary.balance >= 0 ? "text-blue-700" : "text-red-700")}>
                R$ {summary.balance.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="transactions" className="gap-2">
              <FileText size={16} /> Lançamentos
            </TabsTrigger>
            <TabsTrigger value="barbers" className="gap-2">
              <Users size={16} /> Por Barbeiro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="pt-4">
            <div className="border rounded-xl bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Barbeiro</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma transação encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>
                              {t.date ? (() => {
                                try {
                                  const parts = String(t.date).split('-');
                                  if (parts.length >= 3) {
                                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                  }
                                  return String(t.date);
                                } catch (e) {
                                  return String(t.date);
                                }
                              })() : "-"}
                            </span>
                            <span className="text-xs text-muted-foreground">{t.time?.substring(0, 5) || "--:--"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{t.description || "-"}</TableCell>
                        <TableCell>{t.barber?.name || "Geral"}</TableCell>
                        <TableCell>{t.category || "-"}</TableCell>
                        <TableCell className={cn("text-right font-bold", t.type === "income" ? "text-green-600" : "text-red-600")}>
                          {t.type === "income" ? "+" : "-"} R$ {(parseFloat(String(t.amount)) || 0).toFixed(2)}
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

          <TabsContent value="barbers" className="pt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {barbers.map((barber) => {
                const barberTransactions = transactions ? transactions.filter(t => t && t.barber_id === barber.id && t.type === 'income') : [];
                const totalReceived = barberTransactions.reduce((acc, t) => acc + (parseFloat(String(t.amount)) || 0), 0);
                
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
              
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-primary">Barbearia (Geral)</CardTitle>
                  <p className="text-xs text-muted-foreground">Vendas e lançamentos sem barbeiro específico</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const generalTransactions = transactions ? transactions.filter(t => t && !t.barber_id && t.type === 'income') : [];
                    const totalGeneral = generalTransactions.reduce((acc, t) => acc + (parseFloat(String(t.amount)) || 0), 0);
                    return (
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-sm font-medium">Total Geral</span>
                        <span className="font-bold text-primary">R$ {totalGeneral.toFixed(2)}</span>
                      </div>
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
      {/* Redundant dialog removed to prevent conflicts */}
      </AppLayout>
  );
}
