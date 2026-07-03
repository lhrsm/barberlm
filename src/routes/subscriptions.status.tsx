import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { withModule } from "@/components/modules/withModule";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity, CheckCircle2, Clock, XCircle, RefreshCw, Search, TrendingUp,
  DollarSign, Users, AlertTriangle, Wallet,
} from "lucide-react";

/**
 * Painel de status de assinaturas dos clientes finais da barbearia.
 * Lista customer_subscriptions com filtros por status, plano e cliente,
 * mais métricas agregadas e drill-down por pagamento (subscription_payments).
 */

type StatusKey = "all" | "active" | "trialing" | "pending_payment" | "past_due" | "canceled" | "paused";

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  active:          { label: "Ativa",     bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2 },
  trialing:        { label: "Trial",     bg: "bg-blue-500/10",    text: "text-blue-400",    icon: Clock },
  pending_payment: { label: "Pendente",  bg: "bg-amber-500/10",   text: "text-amber-400",   icon: Clock },
  past_due:        { label: "Falha",     bg: "bg-red-500/10",     text: "text-red-400",     icon: AlertTriangle },
  canceled:        { label: "Cancelada", bg: "bg-slate-500/10",   text: "text-slate-400",   icon: XCircle },
  paused:          { label: "Pausada",   bg: "bg-purple-500/10",  text: "text-purple-400",  icon: Clock },
};

const PAYMENT_STATUS: Record<string, { label: string; text: string }> = {
  paid:     { label: "Pago",       text: "text-emerald-400" },
  pending:  { label: "Pendente",   text: "text-amber-400" },
  failed:   { label: "Falhou",     text: "text-red-400" },
  refunded: { label: "Estornado",  text: "text-orange-400" },
  canceled: { label: "Cancelado",  text: "text-slate-400" },
};

function SubscriptionStatusPage() {
  const { user } = useAuth();
  const tenantId = user?.id;

  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [status, setStatus] = useState<StatusKey>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  const fetchAll = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [subsRes, plansRes] = await Promise.all([
      supabase
        .from("customer_subscriptions")
        .select(`
          id, status, amount, currency, created_at, updated_at, started_at,
          current_period_start, current_period_end, next_billing_at, canceled_at,
          provider, provider_subscription_id, gateway_id, payment_method, metadata,
          customer:customers(id, name, phone, email),
          plan:subscription_plans(id, name, monthly_price)
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("subscription_plans").select("id, name").eq("tenant_id", tenantId).order("name"),
    ]);
    setSubs(subsRes.data ?? []);
    setPlans(plansRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [tenantId]);

  const openDetail = async (sub: any) => {
    setDetail(sub);
    const { data } = await supabase
      .from("subscription_payments")
      .select("id, status, amount, currency, payment_method, provider_payment_id, paid_at, created_at, invoice_url, error_message")
      .eq("subscription_id", sub.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setPayments(data ?? []);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (planFilter !== "all" && s.plan?.id !== planFilter) return false;
      if (term) {
        const hay = `${s.customer?.name ?? ""} ${s.customer?.phone ?? ""} ${s.customer?.email ?? ""} ${s.plan?.name ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [subs, status, planFilter, search]);

  const metrics = useMemo(() => {
    const active = subs.filter((s) => s.status === "active" || s.status === "trialing");
    const pending = subs.filter((s) => s.status === "pending_payment").length;
    const failed = subs.filter((s) => s.status === "past_due").length;
    const mrr = active.reduce((sum, s) => sum + Number(s.amount ?? s.plan?.monthly_price ?? 0), 0);
    return {
      total: subs.length,
      active: active.length,
      pending,
      failed,
      canceled: subs.filter((s) => s.status === "canceled").length,
      mrr,
    };
  }, [subs]);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ea580c]/10 border border-[#ea580c]/20">
              <Wallet className="h-5 w-5 text-[#ea580c]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-white">
                Status das Assinaturas
              </h1>
              <p className="text-sm text-slate-400 mt-1 leading-snug">
                Acompanhe pagamentos e ciclos de todos os clientes assinantes.
              </p>
            </div>
          </div>
          <Button onClick={fetchAll} variant="outline" className="border-[#1f2937] text-slate-300 hover:bg-[#0b0f17]">
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        {/* MÉTRICAS */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Metric label="Total" value={metrics.total} icon={Users} color="text-blue-400" />
          <Metric label="Ativas" value={metrics.active} icon={CheckCircle2} color="text-emerald-400" />
          <Metric label="Pendentes" value={metrics.pending} icon={Clock} color="text-amber-400" />
          <Metric label="Com falha" value={metrics.failed} icon={AlertTriangle} color="text-red-400" />
          <Metric label="Canceladas" value={metrics.canceled} icon={XCircle} color="text-slate-400" />
          <Metric
            label="MRR estimado"
            value={`R$ ${metrics.mrr.toFixed(2)}`}
            icon={TrendingUp}
            color="text-[#ea580c]"
          />
        </div>

        {/* FILTROS */}
        <Card className="bg-[#0b0f17] border-[#1f2937]">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, telefone, e-mail ou plano..."
                className="pl-9 bg-[#050810] border-[#1f2937] text-white"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
              <SelectTrigger className="w-full md:w-52 bg-[#050810] border-[#1f2937] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="pending_payment">Pendentes</SelectItem>
                <SelectItem value="past_due">Com falha</SelectItem>
                <SelectItem value="canceled">Canceladas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full md:w-56 bg-[#050810] border-[#1f2937] text-white">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* TABELA */}
        <Card className="bg-[#0b0f17] border-[#1f2937]">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Nenhuma assinatura encontrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1f2937] hover:bg-transparent">
                      <TableHead className="text-slate-400 uppercase text-xs">Cliente</TableHead>
                      <TableHead className="text-slate-400 uppercase text-xs">Plano</TableHead>
                      <TableHead className="text-slate-400 uppercase text-xs">Status</TableHead>
                      <TableHead className="text-slate-400 uppercase text-xs">Valor</TableHead>
                      <TableHead className="text-slate-400 uppercase text-xs">Gateway</TableHead>
                      <TableHead className="text-slate-400 uppercase text-xs">Próx. cobrança</TableHead>
                      <TableHead className="text-slate-400 uppercase text-xs">Criada</TableHead>
                      <TableHead className="text-right text-slate-400 uppercase text-xs">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => {
                      const st = STATUS_STYLES[s.status] ?? STATUS_STYLES.canceled;
                      const Icon = st.icon;
                      return (
                        <TableRow key={s.id} className="border-[#1f2937] hover:bg-[#050810]/60">
                          <TableCell>
                            <div className="text-white font-medium text-sm">{s.customer?.name ?? "—"}</div>
                            <div className="text-xs text-slate-500">{s.customer?.phone ?? s.customer?.email ?? ""}</div>
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">{s.plan?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className={`${st.bg} ${st.text} border-0 gap-1`}>
                              <Icon className="h-3 w-3" /> {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white text-sm">
                            R$ {Number(s.amount ?? s.plan?.monthly_price ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-slate-400 text-xs uppercase">{s.provider ?? s.payment_method}</TableCell>
                          <TableCell className="text-slate-400 text-xs">
                            {s.current_period_end ? format(new Date(s.current_period_end), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            {format(new Date(s.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#ea580c] hover:bg-[#ea580c]/10"
                              onClick={() => openDetail(s)}
                            >
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DRILL-DOWN */}
        <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
          <DialogContent className="bg-[#0b0f17] border-[#1f2937] text-white max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-white">
                Assinatura de {detail?.customer?.name ?? "—"}
              </DialogTitle>
            </DialogHeader>
            {detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Plano</div>
                    <div>{detail.plan?.name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Valor</div>
                    <div>R$ {Number(detail.amount ?? 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Gateway</div>
                    <div className="uppercase">{detail.provider ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Provider ID</div>
                    <div className="truncate font-mono text-xs">{detail.provider_subscription_id ?? "—"}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-bold uppercase text-slate-300 mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Histórico de pagamentos
                  </div>
                  {payments.length === 0 ? (
                    <div className="text-xs text-slate-500 p-4 border border-dashed border-[#1f2937] rounded-lg text-center">
                      Nenhum pagamento registrado ainda.
                    </div>
                  ) : (
                    <div className="border border-[#1f2937] rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#1f2937] hover:bg-transparent">
                            <TableHead className="text-slate-400 text-xs">Status</TableHead>
                            <TableHead className="text-slate-400 text-xs">Valor</TableHead>
                            <TableHead className="text-slate-400 text-xs">Método</TableHead>
                            <TableHead className="text-slate-400 text-xs">Pago em</TableHead>
                            <TableHead className="text-slate-400 text-xs">ID Provider</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((p) => {
                            const ps = PAYMENT_STATUS[p.status] ?? { label: p.status, text: "text-slate-400" };
                            return (
                              <TableRow key={p.id} className="border-[#1f2937]">
                                <TableCell className={ps.text}>{ps.label}</TableCell>
                                <TableCell>R$ {Number(p.amount ?? 0).toFixed(2)}</TableCell>
                                <TableCell className="text-slate-400 text-xs">{p.payment_method ?? "—"}</TableCell>
                                <TableCell className="text-xs text-slate-400">
                                  {p.paid_at ? format(new Date(p.paid_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-500 truncate max-w-[180px]">
                                  {p.provider_payment_id ?? "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {detail.metadata?.checkout_url && (
                  <a
                    href={detail.metadata.checkout_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#ea580c] hover:underline"
                  >
                    Abrir checkout pendente →
                  </a>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export const Route = createFileRoute("/subscriptions/status")({
  head: () => ({
    meta: [
      { title: "Status das Assinaturas — Barbex" },
      { name: "description", content: "Acompanhe pagamentos e ciclos das assinaturas dos seus clientes." },
    ],
  }),
  component: withModule("subscriptions", "Assinaturas", SubscriptionStatusPage),
});

function Metric({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <Card className="bg-[#0b0f17] border-[#1f2937]">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className={`text-xl font-black mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
