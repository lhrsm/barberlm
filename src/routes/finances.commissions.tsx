import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { toast } from "sonner";
import { Trophy, DollarSign, Users, TrendingUp, Target, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/finances/commissions")({
  component: CommissionsPage,
});

type Entry = {
  id: string;
  barber_id: string;
  appointment_id: string;
  customer_id: string | null;
  service_amount: number;
  commission_amount: number;
  paid_amount: number;
  status: string;
  earned_at: string;
};

type Barber = {
  id: string;
  name: string;
  commission_type: string;
  commission_rate: number;
  commission_fixed_value: number;
  commission_bonus_value: number;
  monthly_goal: number;
};

type Closing = {
  id: string;
  barber_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function firstDay() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function CommissionsPage() {
  const { user, loading } = useAuth();
  const [from, setFrom] = useState(firstDay());
  const [to, setTo] = useState(today());
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [commissionBase, setCommissionBase] = useState("gross");
  const [loadingData, setLoadingData] = useState(true);
  const [payDialog, setPayDialog] = useState<{ barberId: string; entryIds: string[]; total: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");

  useEffect(() => {
    if (!loading && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, from, to]);

  async function load() {
    if (!user) return;
    setLoadingData(true);
    try {
      const [{ data: bs }, { data: es }, { data: cs }, { data: ap }, { data: prof }] = await Promise.all([
        supabase.from("barbers").select("id, name, commission_type, commission_rate, commission_fixed_value, commission_bonus_value, monthly_goal").eq("user_id", user.id).order("name"),
        supabase.from("commission_entries").select("*").eq("tenant_id", user.id).gte("earned_at", from).lte("earned_at", to + "T23:59:59").order("earned_at", { ascending: false }),
        supabase.from("commission_closings").select("*").eq("tenant_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("appointments").select("id, barber_id, customer_id, total_price, completed_at").eq("tenant_id", user.id).eq("status", "completed").gte("completed_at", from).lte("completed_at", to + "T23:59:59"),
        supabase.from("profiles").select("commission_base").eq("id", user.id).maybeSingle(),
      ]);
      setBarbers((bs ?? []) as Barber[]);
      setEntries((es ?? []) as Entry[]);
      setClosings((cs ?? []) as Closing[]);
      setAppts(ap ?? []);
      setCommissionBase(prof?.commission_base ?? "gross");
    } finally {
      setLoadingData(false);
    }
  }

  async function saveCommissionBase(value: string) {
    if (!user) return;
    setCommissionBase(value);
    const { error } = await supabase.from("profiles").update({ commission_base: value }).eq("id", user.id);
    if (error) toast.error("Erro ao salvar base de cálculo");
    else toast.success("Base de cálculo atualizada");
  }

  async function recalc() {
    if (!user) return;
    const { data, error } = await supabase.rpc("recalculate_barber_commissions", {
      p_tenant_id: user.id, p_from: from, p_to: to,
    });
    if (error) toast.error(error.message);
    else { toast.success(`${data ?? 0} atendimentos recalculados`); load(); }
  }

  // por barbeiro
  const byBarber = useMemo(() => {
    return barbers.map(b => {
      const bEntries = entries.filter(e => e.barber_id === b.id);
      const bAppts = appts.filter(a => a.barber_id === b.id);
      const production = bAppts.reduce((s, a) => s + Number(a.total_price ?? 0), 0);
      const uniqueCust = new Set(bAppts.map(a => a.customer_id)).size;
      const services = bAppts.length;
      const avgTicket = services > 0 ? production / services : 0;
      const accrued = bEntries.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
      const paid = bEntries.reduce((s, e) => s + Number(e.paid_amount ?? 0), 0);
      const pending = accrued - paid;
      const goalPct = b.monthly_goal > 0 ? Math.min(100, (production / b.monthly_goal) * 100) : 0;
      // retenção: % de clientes do período que tem mais de 1 atendimento no ano com este barbeiro
      const recurrent = uniqueCust > 0
        ? Array.from(new Set(bAppts.map(a => a.customer_id))).filter(cId => bAppts.filter(a => a.customer_id === cId).length > 1).length / uniqueCust * 100
        : 0;
      return { barber: b, production, uniqueCust, services, avgTicket, accrued, paid, pending, goalPct, recurrent };
    });
  }, [barbers, entries, appts]);

  const ranking = useMemo(() => {
    const sorted = [...byBarber];
    return {
      faturamento: [...sorted].sort((a, b) => b.production - a.production)[0],
      atendimentos: [...sorted].sort((a, b) => b.services - a.services)[0],
      ticket: [...sorted].sort((a, b) => b.avgTicket - a.avgTicket)[0],
      retencao: [...sorted].sort((a, b) => b.recurrent - a.recurrent)[0],
    };
  }, [byBarber]);

  function openPayDialog(barberId: string) {
    const pending = entries.filter(e => e.barber_id === barberId && e.status !== "paid");
    const total = pending.reduce((s, e) => s + (Number(e.commission_amount) - Number(e.paid_amount)), 0);
    setPayDialog({ barberId, entryIds: pending.map(e => e.id), total });
    setPayAmount(total.toFixed(2));
    setPayNotes("");
  }

  async function confirmPay() {
    if (!payDialog) return;
    const { data, error } = await supabase.rpc("pay_commission_entries", {
      p_barber_id: payDialog.barberId,
      p_entry_ids: payDialog.entryIds,
      p_amount: Number(payAmount),
      p_notes: payNotes || undefined,
    });
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (!r?.success) { toast.error(r?.error ?? "Falha ao registrar pagamento"); return; }
    toast.success("Pagamento registrado");
    setPayDialog(null);
    load();
  }

  if (loading || loadingData) {
    return <AppLayout><div className="p-6">Carregando…</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Comissões</h1>
            <p className="text-muted-foreground text-sm">Produção, fechamento e ranking dos barbeiros</p>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={recalc}><RefreshCcw className="h-4 w-4 mr-1" />Recalcular</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Base de cálculo da comissão</CardTitle>
            <CardDescription>Define como a comissão é calculada sobre os atendimentos</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={commissionBase} onValueChange={saveCommissionBase}>
              <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gross">Valor integral do serviço</SelectItem>
                <SelectItem value="net_cash">Apenas dinheiro novo (exclui créditos/cashback)</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
            <TabsTrigger value="closings">Fechamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 mt-4">
            {byBarber.length === 0 && <p className="text-muted-foreground">Nenhum barbeiro cadastrado.</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {byBarber.map(b => (
                <Card key={b.barber.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{b.barber.name}</CardTitle>
                        <CardDescription>
                          {b.barber.commission_type === 'percentage' && `${b.barber.commission_rate}%`}
                          {b.barber.commission_type === 'fixed' && `${fmt(b.barber.commission_fixed_value)} / atend.`}
                          {b.barber.commission_type === 'hybrid' && `${b.barber.commission_rate}% + ${fmt(b.barber.commission_bonus_value)}`}
                        </CardDescription>
                      </div>
                      <Button size="sm" onClick={() => openPayDialog(b.barber.id)} disabled={b.pending <= 0}>Fechar pagamento</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><div className="text-muted-foreground text-xs">Produção</div><div className="font-semibold">{fmt(b.production)}</div></div>
                      <div><div className="text-muted-foreground text-xs">Atendimentos</div><div className="font-semibold">{b.services}</div></div>
                      <div><div className="text-muted-foreground text-xs">Clientes</div><div className="font-semibold">{b.uniqueCust}</div></div>
                      <div><div className="text-muted-foreground text-xs">Ticket médio</div><div className="font-semibold">{fmt(b.avgTicket)}</div></div>
                      <div><div className="text-muted-foreground text-xs">Comissão</div><div className="font-semibold">{fmt(b.accrued)}</div></div>
                      <div><div className="text-muted-foreground text-xs">Pendente</div><div className="font-semibold text-amber-600">{fmt(b.pending)}</div></div>
                    </div>
                    {b.barber.monthly_goal > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Meta {fmt(b.barber.monthly_goal)}</span>
                          <span>{b.goalPct.toFixed(0)}%</span>
                        </div>
                        <Progress value={b.goalPct} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <RankCard icon={<Trophy className="h-4 w-4" />} label="Maior faturamento" b={ranking.faturamento} value={ranking.faturamento ? fmt(ranking.faturamento.production) : "-"} />
              <RankCard icon={<Users className="h-4 w-4" />} label="Mais atendimentos" b={ranking.atendimentos} value={ranking.atendimentos ? String(ranking.atendimentos.services) : "-"} />
              <RankCard icon={<TrendingUp className="h-4 w-4" />} label="Maior ticket médio" b={ranking.ticket} value={ranking.ticket ? fmt(ranking.ticket.avgTicket) : "-"} />
              <RankCard icon={<Target className="h-4 w-4" />} label="Maior retenção" b={ranking.retencao} value={ranking.retencao ? `${ranking.retencao.recurrent.toFixed(0)}%` : "-"} />
            </div>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Lançamentos no período</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Barbeiro</TableHead>
                      <TableHead>Serviço (R$)</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>{new Date(e.earned_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{barbers.find(b => b.id === e.barber_id)?.name ?? "-"}</TableCell>
                        <TableCell>{fmt(Number(e.service_amount))}</TableCell>
                        <TableCell>{fmt(Number(e.commission_amount))}</TableCell>
                        <TableCell>{fmt(Number(e.paid_amount))}</TableCell>
                        <TableCell><Badge variant={e.status === 'paid' ? 'default' : e.status === 'partially_paid' ? 'secondary' : 'outline'}>{e.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {entries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem lançamentos no período</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="closings" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Histórico de fechamentos</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Barbeiro</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pago em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closings.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>{new Date(c.period_start).toLocaleDateString("pt-BR")} — {new Date(c.period_end).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{barbers.find(b => b.id === c.barber_id)?.name ?? "-"}</TableCell>
                        <TableCell>{fmt(Number(c.total_amount))}</TableCell>
                        <TableCell>{fmt(Number(c.paid_amount))}</TableCell>
                        <TableCell><Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                        <TableCell>{c.paid_at ? new Date(c.paid_at).toLocaleString("pt-BR") : "-"}</TableCell>
                      </TableRow>
                    ))}
                    {closings.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum fechamento</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Total pendente: <strong>{fmt(payDialog.total)}</strong></p>
              <div>
                <Label>Valor pago</Label>
                <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Igual ao total = pago. Menor = parcialmente pago.</p>
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="opcional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button onClick={confirmPay}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function RankCard({ icon, label, b, value }: { icon: React.ReactNode; label: string; b: any; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">{icon}{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{b?.barber?.name ?? "-"}</div>
      </CardContent>
    </Card>
  );
}
