import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Trophy,
  DollarSign,
  Users,
  TrendingUp,
  Target,
  RefreshCcw,
  CircleDollarSign,
  Wallet,
  Receipt,
  Crown,
  Medal,
  Award,
} from "lucide-react";

export const Route = createFileRoute("/commissions")({
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
  return new Date(d.getFullYear(), d.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
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
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [commTab, setCommTab] = useState<string>("dashboard");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payDialog, setPayDialog] = useState<{
    barberId: string;
    entryIds: string[];
    total: number;
  } | null>(null);
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
      const [
        { data: bs },
        { data: es },
        { data: cs },
        { data: ap },
        { data: prof },
      ] = await Promise.all([
        supabase
          .from("barbers")
          .select(
            "id, name, commission_type, commission_rate, commission_fixed_value, commission_bonus_value, monthly_goal"
          )
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("commission_entries")
          .select("*")
          .eq("tenant_id", user.id)
          .gte("earned_at", from)
          .lte("earned_at", to + "T23:59:59")
          .order("earned_at", { ascending: false }),
        supabase
          .from("commission_closings")
          .select("*")
          .eq("tenant_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("appointments")
          .select("id, barber_id, customer_id, total_price, completed_at")
          .eq("tenant_id", user.id)
          .eq("status", "completed")
          .gte("completed_at", from)
          .lte("completed_at", to + "T23:59:59"),
        supabase
          .from("profiles")
          .select("commission_base")
          .eq("id", user.id)
          .maybeSingle(),
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
    const { error } = await supabase
      .from("profiles")
      .update({ commission_base: value })
      .eq("id", user.id);
    if (error) toast.error("Erro ao salvar base de cálculo");
    else toast.success("Base de cálculo atualizada");
  }

  async function recalc() {
    if (!user) return;
    const { data, error } = await supabase.rpc(
      "recalculate_barber_commissions",
      { p_tenant_id: user.id, p_from: from, p_to: to }
    );
    if (error) toast.error(error.message);
    else {
      toast.success(`${data ?? 0} atendimentos recalculados`);
      load();
    }
  }

  const byBarber = useMemo(() => {
    return barbers.map((b) => {
      const bEntries = entries.filter((e) => e.barber_id === b.id);
      const bAppts = appts.filter((a) => a.barber_id === b.id);
      const production = bAppts.reduce(
        (s, a) => s + Number(a.total_price ?? 0),
        0
      );
      const uniqueCust = new Set(bAppts.map((a) => a.customer_id)).size;
      const services = bAppts.length;
      const avgTicket = services > 0 ? production / services : 0;
      const accrued = bEntries.reduce(
        (s, e) => s + Number(e.commission_amount ?? 0),
        0
      );
      const paid = bEntries.reduce(
        (s, e) => s + Number(e.paid_amount ?? 0),
        0
      );
      const pending = accrued - paid;
      const goalPct =
        b.monthly_goal > 0
          ? Math.min(100, (production / b.monthly_goal) * 100)
          : 0;
      const recurrent =
        uniqueCust > 0
          ? (Array.from(new Set(bAppts.map((a) => a.customer_id))).filter(
              (cId) =>
                bAppts.filter((a) => a.customer_id === cId).length > 1
            ).length /
              uniqueCust) *
            100
          : 0;
      return {
        barber: b,
        production,
        uniqueCust,
        services,
        avgTicket,
        accrued,
        paid,
        pending,
        goalPct,
        recurrent,
      };
    });
  }, [barbers, entries, appts]);

  const kpis = useMemo(() => {
    const faturamento = byBarber.reduce((s, b) => s + b.production, 0);
    const geradas = byBarber.reduce((s, b) => s + b.accrued, 0);
    const pagas = byBarber.reduce((s, b) => s + b.paid, 0);
    const pendentes = geradas - pagas;
    const melhor = [...byBarber].sort((a, b) => b.production - a.production)[0];
    return { faturamento, geradas, pagas, pendentes, melhor };
  }, [byBarber]);

  const rankingList = useMemo(
    () => [...byBarber].sort((a, b) => b.production - a.production),
    [byBarber]
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (barberFilter !== "all" && e.barber_id !== barberFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [entries, barberFilter, statusFilter]);

  function openPayDialog(barberId: string) {
    const pending = entries.filter(
      (e) => e.barber_id === barberId && e.status !== "paid"
    );
    const total = pending.reduce(
      (s, e) => s + (Number(e.commission_amount) - Number(e.paid_amount)),
      0
    );
    setPayDialog({
      barberId,
      entryIds: pending.map((e) => e.id),
      total,
    });
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
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = data as any;
    if (!r?.success) {
      toast.error(r?.error ?? "Falha ao registrar pagamento");
      return;
    }
    toast.success("Pagamento registrado");
    setPayDialog(null);
    load();
  }

  if (loading || loadingData) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-[#05070d]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
            <p className="text-zinc-500 text-sm font-medium">
              Carregando comissões...
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <header className="flex flex-col gap-3 p-4 md:p-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4 min-w-0">
              <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 grid place-items-center shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
                <CircleDollarSign className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-tight break-words">
                  Comissões
                </h1>
                <p className="text-sm text-zinc-400 mt-1 leading-snug break-words">
                  Produção, fechamento e ranking dos barbeiros
                </p>
              </div>
            </div>
            <div className="flex w-full sm:w-auto shrink-0">
              <Button
                onClick={recalc}
                className="w-full sm:w-auto h-[42px] bg-[#0b0f17] border border-zinc-700 text-white hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 font-bold transition-all hover:-translate-y-0.5"
              >
                <RefreshCcw className="h-4 w-4 mr-2" /> Recalcular
              </Button>
            </div>
          </header>

          {/* FILTROS DE PERÍODO */}
          <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                De
              </Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-[#05070d] border-zinc-800 text-white h-10 focus-visible:border-emerald-500/60 focus-visible:ring-emerald-500/20"
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                Até
              </Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-[#05070d] border-zinc-800 text-white h-10 focus-visible:border-emerald-500/60 focus-visible:ring-emerald-500/20"
              />
            </div>
            <div className="md:col-span-6">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                Base de cálculo da comissão
              </Label>
              <Select value={commissionBase} onValueChange={saveCommissionBase}>
                <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-10 focus:border-emerald-500/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                  <SelectItem value="gross">
                    Valor integral do serviço
                  </SelectItem>
                  <SelectItem value="net_cash">
                    Apenas dinheiro novo (exclui créditos/cashback)
                  </SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              icon={DollarSign}
              label="Faturamento Total"
              value={fmt(kpis.faturamento)}
              hint="Bruto produzido no período"
              accent="emerald"
            />
            <KpiCard
              icon={TrendingUp}
              label="Comissões Geradas"
              value={fmt(kpis.geradas)}
              hint="Total acumulado"
              accent="sky"
            />
            <KpiCard
              icon={Wallet}
              label="Comissões Pagas"
              value={fmt(kpis.pagas)}
              hint="Já quitadas"
              accent="purple"
            />
            <KpiCard
              icon={Target}
              label="Comissões Pendentes"
              value={fmt(kpis.pendentes)}
              hint="A pagar"
              accent="amber"
            />
            <KpiCard
              icon={Trophy}
              label="Melhor Barbeiro"
              value={kpis.melhor?.barber.name ?? "-"}
              hint={
                kpis.melhor
                  ? `${kpis.melhor.services} atend. · ${fmt(
                      kpis.melhor.production
                    )}`
                  : undefined
              }
              accent="emerald"
            />
          </div>

          {/* TABS */}
          <Tabs value={commTab} onValueChange={setCommTab} className="w-full">
            <TabsList className="hidden md:flex bg-[#0b0f17] border border-zinc-800/80 p-1.5 h-auto rounded-2xl gap-1 flex-wrap">
              {[
                { v: "dashboard", label: "Dashboard", icon: TrendingUp },
                { v: "ranking", label: "Ranking", icon: Trophy },
                { v: "reports", label: "Relatórios", icon: Receipt },
                { v: "closings", label: "Fechamentos", icon: Wallet },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="gap-2 px-5 py-2.5 rounded-xl text-zinc-400 font-bold text-xs uppercase tracking-wider transition-all hover:text-emerald-400 hover:bg-emerald-500/5 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:shadow-[inset_0_-2px_0_0_rgb(16,185,129)]"
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Mobile premium tabs (Mercado Pago style) */}
            <div className="md:hidden rounded-[24px] border border-emerald-500/15 bg-[#0A1020] overflow-hidden">
              <div className="premium-tabs-scroll overflow-x-auto bg-[#050816] px-2 pt-2">
                <div className="flex w-max min-w-full items-end gap-1">
                  {[
                    { v: "dashboard", icon: TrendingUp, label: "Dashboard" },
                    { v: "ranking", icon: Trophy, label: "Ranking" },
                    { v: "reports", icon: Receipt, label: "Relatórios" },
                    { v: "closings", icon: Wallet, label: "Fechamentos" },
                  ].map(({ v, icon: Icon, label }) => {
                    const active = commTab === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCommTab(v)}
                        className={cn(
                          "group relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all duration-300 rounded-t-[22px] focus-visible:outline-none",
                          active
                            ? "bg-white text-[#111111] font-bold shadow-[0_-2px_12px_rgba(0,0,0,.15)]"
                            : "text-white/70 hover:text-white"
                        )}
                      >
                        <Icon size={15} className="opacity-90" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>


            {/* DASHBOARD */}
            <TabsContent value="dashboard" className="mt-6 space-y-4">
              {byBarber.length === 0 && (
                <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-10 text-center text-zinc-500">
                  Nenhum barbeiro cadastrado.
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {byBarber.map((b) => (
                  <div
                    key={b.barber.id}
                    className="bg-[#0b0f17] border border-zinc-800/80 hover:border-emerald-500/30 rounded-2xl p-4 sm:p-5 transition-all hover:shadow-[0_8px_28px_rgba(16,185,129,0.12)]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0">
                          <Users className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black truncate">
                            {b.barber.name}
                          </h3>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mt-0.5">
                            {b.barber.commission_type === "percentage" &&
                              `${b.barber.commission_rate}%`}
                            {b.barber.commission_type === "fixed" &&
                              `${fmt(b.barber.commission_fixed_value)} / atend.`}
                            {b.barber.commission_type === "hybrid" &&
                              `${b.barber.commission_rate}% + ${fmt(
                                b.barber.commission_bonus_value
                              )}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openPayDialog(b.barber.id)}
                        disabled={b.pending <= 0}
                        className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.25)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Pagar Comissão
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      <Metric label="Produção" value={fmt(b.production)} />
                      <Metric label="Atendimentos" value={String(b.services)} />
                      <Metric label="Clientes" value={String(b.uniqueCust)} />
                      <Metric label="Ticket médio" value={fmt(b.avgTicket)} />
                      <Metric
                        label="Comissão"
                        value={fmt(b.accrued)}
                        tone="sky"
                      />
                      <Metric
                        label="Pendente"
                        value={fmt(b.pending)}
                        tone="amber"
                      />
                    </div>

                    {b.barber.monthly_goal > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-[11px] mb-1.5">
                          <span className="text-zinc-500 font-bold uppercase tracking-wider">
                            Meta {fmt(b.barber.monthly_goal)}
                          </span>
                          <span className="text-emerald-400 font-black">
                            {b.goalPct.toFixed(0)}%
                          </span>
                        </div>
                        <Progress
                          value={b.goalPct}
                          className="h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-emerald-400"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* RANKING */}
            <TabsContent value="ranking" className="mt-6 space-y-4">
              {rankingList.length === 0 ? (
                <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-10 text-center text-zinc-500">
                  Sem dados para o período.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {rankingList.slice(0, 3).map((b, i) => (
                    <PodiumCard key={b.barber.id} place={i + 1} data={b} />
                  ))}
                  {rankingList.length > 3 && (
                    <div className="md:col-span-3 bg-[#0b0f17] border border-zinc-800/80 rounded-2xl overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-zinc-800 hover:bg-transparent">
                            <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                              #
                            </TableHead>
                            <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                              Barbeiro
                            </TableHead>
                            <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                              Faturamento
                            </TableHead>
                            <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                              Atendimentos
                            </TableHead>
                            <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                              Comissão
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingList.slice(3).map((b, i) => (
                            <TableRow
                              key={b.barber.id}
                              className="border-zinc-800 hover:bg-emerald-500/5"
                            >
                              <TableCell className="text-zinc-400 font-bold">
                                {i + 4}º
                              </TableCell>
                              <TableCell className="font-bold text-white">
                                {b.barber.name}
                              </TableCell>
                              <TableCell className="text-white">
                                {fmt(b.production)}
                              </TableCell>
                              <TableCell className="text-white">
                                {b.services}
                              </TableCell>
                              <TableCell className="text-emerald-400 font-bold">
                                {fmt(b.accrued)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* RELATÓRIOS */}
            <TabsContent value="reports" className="mt-6 space-y-4">
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                    Barbeiro
                  </Label>
                  <Select value={barberFilter} onValueChange={setBarberFilter}>
                    <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-10 focus:border-emerald-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                      <SelectItem value="all">Todos</SelectItem>
                      {barbers.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-6">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                    Status
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-10 focus:border-emerald-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="partially_paid">Parcial</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Data
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Barbeiro
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Serviço (R$)
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Comissão
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Pago
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((e) => (
                      <TableRow
                        key={e.id}
                        className="border-zinc-800 hover:bg-emerald-500/5"
                      >
                        <TableCell className="text-zinc-300">
                          {new Date(e.earned_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-white font-bold">
                          {barbers.find((b) => b.id === e.barber_id)?.name ??
                            "-"}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {fmt(Number(e.service_amount))}
                        </TableCell>
                        <TableCell className="text-emerald-400 font-bold">
                          {fmt(Number(e.commission_amount))}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {fmt(Number(e.paid_amount))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={e.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredEntries.length === 0 && (
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableCell
                          colSpan={6}
                          className="text-center text-zinc-500 py-10"
                        >
                          Sem lançamentos para os filtros aplicados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* FECHAMENTOS */}
            <TabsContent value="closings" className="mt-6">
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Período
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Barbeiro
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Total
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Pago
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Status
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                        Pago em
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closings.map((c) => (
                      <TableRow
                        key={c.id}
                        className="border-zinc-800 hover:bg-emerald-500/5"
                      >
                        <TableCell className="text-zinc-300">
                          {new Date(c.period_start).toLocaleDateString("pt-BR")}{" "}
                          —{" "}
                          {new Date(c.period_end).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-white font-bold">
                          {barbers.find((b) => b.id === c.barber_id)?.name ??
                            "-"}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {fmt(Number(c.total_amount))}
                        </TableCell>
                        <TableCell className="text-emerald-400 font-bold">
                          {fmt(Number(c.paid_amount))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {c.paid_at
                            ? new Date(c.paid_at).toLocaleString("pt-BR")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {closings.length === 0 && (
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableCell
                          colSpan={6}
                          className="text-center text-zinc-500 py-10"
                        >
                          Nenhum fechamento registrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* PAGAMENTO */}
      <Dialog
        open={!!payDialog}
        onOpenChange={(o) => !o && setPayDialog(null)}
      >
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Registrar pagamento
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
                  Total pendente
                </div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {fmt(payDialog.total)}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                  Valor pago
                </Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="bg-[#05070d] border-zinc-800 text-white h-10 focus-visible:border-emerald-500/60 focus-visible:ring-emerald-500/20"
                />
                <p className="text-xs text-zinc-500 mt-1.5">
                  Igual ao total = pago. Menor = parcialmente pago.
                </p>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                  Observações
                </Label>
                <Input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="opcional"
                  className="bg-[#05070d] border-zinc-800 text-white h-10 focus-visible:border-emerald-500/60 focus-visible:ring-emerald-500/20"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setPayDialog(null)}
              className="bg-[#0b0f17] border border-zinc-700 text-white hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50 font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmPay}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
            >
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  accent: "emerald" | "sky" | "purple" | "amber";
}) {
  const accents: Record<
    string,
    { bg: string; text: string; border: string; glow: string }
  > = {
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "hover:border-emerald-500/40",
      glow: "hover:shadow-[0_8px_28px_rgba(16,185,129,0.18)]",
    },
    sky: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "hover:border-sky-500/40",
      glow: "hover:shadow-[0_8px_28px_rgba(56,189,248,0.18)]",
    },
    purple: {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "hover:border-purple-500/40",
      glow: "hover:shadow-[0_8px_28px_rgba(168,85,247,0.18)]",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "hover:border-amber-500/40",
      glow: "hover:shadow-[0_8px_28px_rgba(245,158,11,0.18)]",
    },
  };
  const a = accents[accent];
  return (
    <div
      className={cn(
        "bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1",
        a.border,
        a.glow
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {label}
        </span>
        <div className={cn("h-9 w-9 rounded-xl grid place-items-center", a.bg)}>
          <Icon className={cn("h-4 w-4", a.text)} />
        </div>
      </div>
      <div className="text-2xl md:text-3xl font-black tracking-tight truncate">
        {value}
      </div>
      {hint && (
        <div className={cn("text-xs mt-1 font-bold truncate", a.text)}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "sky" | "amber";
}) {
  const toneCls =
    tone === "sky"
      ? "text-sky-400"
      : tone === "amber"
      ? "text-amber-400"
      : "text-white";
  return (
    <div className="bg-[#05070d]/60 border border-zinc-800/60 rounded-xl p-2.5">
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div className={cn("text-sm font-black mt-0.5 truncate", toneCls)}>
        {value}
      </div>
    </div>
  );
}

function PodiumCard({
  place,
  data,
}: {
  place: number;
  data: {
    barber: Barber;
    production: number;
    services: number;
    accrued: number;
  };
}) {
  const styles =
    place === 1
      ? {
          icon: Crown,
          color: "text-yellow-400",
          bg: "from-yellow-500/15 to-yellow-600/0",
          border: "border-yellow-500/40",
          medal: "🥇",
        }
      : place === 2
      ? {
          icon: Medal,
          color: "text-zinc-300",
          bg: "from-zinc-400/15 to-zinc-500/0",
          border: "border-zinc-400/40",
          medal: "🥈",
        }
      : {
          icon: Award,
          color: "text-orange-400",
          bg: "from-orange-500/15 to-orange-600/0",
          border: "border-orange-500/40",
          medal: "🥉",
        };
  const Icon = styles.icon;
  return (
    <div
      className={cn(
        "relative bg-gradient-to-br rounded-2xl p-5 border transition-all hover:-translate-y-1",
        styles.bg,
        styles.border,
        "bg-[#0b0f17]"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("h-12 w-12 rounded-2xl grid place-items-center bg-black/40 border", styles.border)}>
          <Icon className={cn("h-6 w-6", styles.color)} />
        </div>
        <span className="text-3xl">{styles.medal}</span>
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {place}º lugar
      </div>
      <h3 className="text-lg font-black mt-1 truncate">{data.barber.name}</h3>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div>
          <div className="text-[10px] font-bold uppercase text-zinc-500">
            Faturamento
          </div>
          <div className={cn("text-sm font-black", styles.color)}>
            {fmt(data.production)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-zinc-500">
            Atend.
          </div>
          <div className="text-sm font-black text-white">{data.services}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-zinc-500">
            Comissão
          </div>
          <div className="text-sm font-black text-emerald-400">
            {fmt(data.accrued)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: {
      label: "Pago",
      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    partially_paid: {
      label: "Parcial",
      cls: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    pending: {
      label: "Pendente",
      cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    },
  };
  const s = map[status] ?? {
    label: status,
    cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  };
  return (
    <Badge
      className={cn(
        "border font-bold text-[10px] uppercase tracking-wider",
        s.cls
      )}
    >
      {s.label}
    </Badge>
  );
}
