import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Users,
  TrendingUp,
  Crown,
  CheckCircle2,
  XCircle,
  DollarSign,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/subscriptions")({
  component: SubscriptionsPage,
});

type PlanType = "hair" | "beard" | "hair_beard" | "custom";
type UsageType = "unlimited" | "limited";
type PaymentMethod = "pix" | "stripe" | "in_person";

interface PlanBenefits {
  product_discount_percent?: number;
  priority_booking?: boolean;
  extra_cashback_percent?: number;
  exclusive_services?: string[];
  notes?: string;
}

interface SubscriptionPlan {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  plan_type: PlanType;
  monthly_price: number;
  usage_type: UsageType;
  max_uses_per_month: number | null;
  benefits: PlanBenefits;
  payment_methods: PaymentMethod[];
  active: boolean;
  display_order: number;
  created_at: string;
}

interface CustomerSub {
  id: string;
  tenant_id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  payment_method: string;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string | null;
  uses_this_period: number;
  auto_renew: boolean;
  plan?: SubscriptionPlan;
  customer?: { id: string; name: string; phone: string | null };
}

interface Invoice {
  id: string;
  tenant_id: string;
  subscription_id: string;
  customer_id: string;
  amount: number;
  status: string;
  payment_method: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  customer?: { name: string };
}

const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  hair: "Só Cabelo",
  beard: "Só Barba",
  hair_beard: "Cabelo + Barba",
  custom: "Personalizado",
};

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  pending_payment: { label: "Pagamento Pendente", variant: "secondary" },
  past_due: { label: "Em Atraso", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "outline" },
  expired: { label: "Expirada", variant: "outline" },
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function emptyPlan(tenantId: string): Partial<SubscriptionPlan> {
  return {
    tenant_id: tenantId,
    name: "",
    description: "",
    plan_type: "custom",
    monthly_price: 0,
    usage_type: "unlimited",
    max_uses_per_month: null,
    benefits: { priority_booking: false },
    payment_methods: ["in_person"],
    active: true,
    display_order: 0,
  };
}

function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const tenantId = user?.id;

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subs, setSubs] = useState<CustomerSub[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [newSubCustomerId, setNewSubCustomerId] = useState("");
  const [newSubPlanId, setNewSubPlanId] = useState("");
  const [newSubPayment, setNewSubPayment] = useState<PaymentMethod>("in_person");
  const [customersList, setCustomersList] = useState<{ id: string; name: string }[]>([]);

  async function loadAll() {
    if (!tenantId) return;
    setLoading(true);
    const [plansRes, subsRes, invRes, custRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("tenant_id", tenantId).order("display_order"),
      supabase
        .from("customer_subscriptions")
        .select("*, plan:subscription_plans(*), customer:customers(id,name,phone)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscription_invoices")
        .select("*, customer:customers(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("customers").select("id,name").eq("user_id", tenantId).order("name"),
    ]);
    if (plansRes.data) setPlans(plansRes.data as any);
    if (subsRes.data) setSubs(subsRes.data as any);
    if (invRes.data) setInvoices(invRes.data as any);
    if (custRes.data) setCustomersList(custRes.data as any);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && tenantId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, tenantId]);

  // KPIs
  const kpis = useMemo(() => {
    const active = subs.filter((s) => s.status === "active");
    const mrr = active.reduce((acc, s) => acc + (Number(s.plan?.monthly_price) || 0), 0);
    const arr = mrr * 12;
    const canceled = subs.filter((s) => s.status === "canceled");
    const total = subs.length || 1;
    const churn = (canceled.length / total) * 100;

    // Planos mais vendidos
    const counts = new Map<string, number>();
    subs.forEach((s) => {
      if (s.plan?.name) counts.set(s.plan.name, (counts.get(s.plan.name) || 0) + 1);
    });
    const topPlans = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { activeCount: active.length, mrr, arr, churn, topPlans };
  }, [subs]);

  // === Plans CRUD ===
  function openNewPlan() {
    if (!tenantId) return;
    setEditingPlan(emptyPlan(tenantId));
    setPlanDialogOpen(true);
  }
  function openEditPlan(p: SubscriptionPlan) {
    setEditingPlan({ ...p, benefits: p.benefits || {} });
    setPlanDialogOpen(true);
  }
  async function savePlan() {
    if (!editingPlan || !tenantId) return;
    if (!editingPlan.name?.trim()) {
      toast.error("Informe o nome do plano");
      return;
    }
    if (editingPlan.usage_type === "limited" && !editingPlan.max_uses_per_month) {
      toast.error("Informe a quantidade máxima de atendimentos");
      return;
    }
    const payload = { ...editingPlan, tenant_id: tenantId };
    const { error } = editingPlan.id
      ? await supabase.from("subscription_plans").update(payload).eq("id", editingPlan.id)
      : await supabase.from("subscription_plans").insert(payload as any);
    if (error) {
      toast.error("Erro ao salvar plano: " + error.message);
      return;
    }
    toast.success("Plano salvo");
    setPlanDialogOpen(false);
    setEditingPlan(null);
    loadAll();
  }
  async function deletePlan(id: string) {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir: " + error.message);
      return;
    }
    toast.success("Plano excluído");
    loadAll();
  }

  // === Nova assinatura manual ===
  async function createSubscription() {
    if (!tenantId || !newSubCustomerId || !newSubPlanId) {
      toast.error("Selecione cliente e plano");
      return;
    }
    const plan = plans.find((p) => p.id === newSubPlanId);
    if (!plan) return;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data: sub, error } = await supabase
      .from("customer_subscriptions")
      .insert({
        tenant_id: tenantId,
        customer_id: newSubCustomerId,
        plan_id: newSubPlanId,
        status: newSubPayment === "in_person" ? "active" : "pending_payment",
        payment_method: newSubPayment,
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_billing_at: periodEnd.toISOString(),
      })
      .select("id")
      .single();
    if (error || !sub) {
      toast.error("Erro: " + (error?.message || "desconhecido"));
      return;
    }
    // Fatura inicial
    await supabase.from("subscription_invoices").insert({
      tenant_id: tenantId,
      subscription_id: sub.id,
      customer_id: newSubCustomerId,
      amount: plan.monthly_price,
      status: newSubPayment === "in_person" ? "paid" : "pending",
      payment_method: newSubPayment,
      due_date: now.toISOString(),
      paid_at: newSubPayment === "in_person" ? now.toISOString() : null,
    });
    toast.success("Assinatura criada");
    setSubDialogOpen(false);
    setNewSubCustomerId("");
    setNewSubPlanId("");
    loadAll();
  }

  async function cancelSubscription(id: string) {
    if (!confirm("Cancelar esta assinatura?")) return;
    const { error } = await supabase
      .from("customer_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), auto_renew: false })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assinatura cancelada");
    loadAll();
  }

  async function markInvoicePaid(inv: Invoice) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("subscription_invoices")
      .update({ status: "paid", paid_at: now })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Reativa assinatura se estava pendente/atrasada
    await supabase
      .from("customer_subscriptions")
      .update({ status: "active" })
      .eq("id", inv.subscription_id)
      .in("status", ["pending_payment", "past_due"]);
    toast.success("Fatura marcada como paga");
    loadAll();
  }

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="p-6 text-muted-foreground">Carregando...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-7 w-7" /> Assinaturas
            </h1>
            <p className="text-muted-foreground text-sm">
              Venda planos mensais para seus clientes (independente de cashback e fidelidade).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSubDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova assinatura
            </Button>
            <Button onClick={openNewPlan}>
              <Plus className="h-4 w-4 mr-1" /> Novo plano
            </Button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Users className="h-4 w-4" />} label="Assinantes Ativos" value={String(kpis.activeCount)} />
          <KpiCard icon={<DollarSign className="h-4 w-4" />} label="MRR" value={formatBRL(kpis.mrr)} />
          <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="ARR" value={formatBRL(kpis.arr)} />
          <KpiCard icon={<XCircle className="h-4 w-4" />} label="Churn" value={`${kpis.churn.toFixed(1)}%`} />
        </div>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="subscribers">Assinantes</TabsTrigger>
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
          </TabsList>

          {/* PLANS */}
          <TabsContent value="plans" className="space-y-3">
            {plans.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum plano cadastrado. Clique em <strong>Novo plano</strong> para começar.
                </CardContent>
              </Card>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.map((p) => (
                <Card key={p.id} className={!p.active ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Crown className="h-4 w-4 text-primary" />
                          {p.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{PLAN_TYPE_LABEL[p.plan_type]}</p>
                      </div>
                      <Badge variant={p.active ? "default" : "outline"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold">{formatBRL(Number(p.monthly_price))}<span className="text-xs font-normal text-muted-foreground">/mês</span></div>
                    <p className="text-sm">
                      {p.usage_type === "unlimited"
                        ? "Atendimentos ilimitados"
                        : `${p.max_uses_per_month} atendimentos/mês`}
                    </p>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    <div className="flex flex-wrap gap-1 pt-2">
                      {p.payment_methods.map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs">
                          {m === "pix" ? "PIX" : m === "stripe" ? "Cartão" : "Presencial"}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-3">
                      <Button size="sm" variant="outline" onClick={() => openEditPlan(p)}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deletePlan(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SUBSCRIBERS */}
          <TabsContent value="subscribers" className="space-y-3">
            {subs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">Nenhum assinante.</CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {subs.map((s) => {
                  const status = STATUS_LABEL[s.status] || { label: s.status, variant: "outline" as const };
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-medium">{s.customer?.name || "Cliente"}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.plan?.name} · {formatBRL(Number(s.plan?.monthly_price || 0))}/mês
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Período até {new Date(s.current_period_end).toLocaleDateString("pt-BR")}
                            {s.plan?.usage_type === "limited" &&
                              ` · ${s.uses_this_period}/${s.plan.max_uses_per_month} usos`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {s.status !== "canceled" && (
                            <Button size="sm" variant="ghost" onClick={() => cancelSubscription(s.id)}>
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* INVOICES */}
          <TabsContent value="invoices" className="space-y-2">
            {invoices.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">Nenhuma fatura.</CardContent>
              </Card>
            ) : (
              invoices.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        {inv.customer?.name || "Cliente"} — {formatBRL(Number(inv.amount))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vencimento: {new Date(inv.due_date).toLocaleDateString("pt-BR")} · {inv.payment_method}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "pending" ? "secondary" : "destructive"}>
                        {inv.status === "paid" ? "Paga" : inv.status === "pending" ? "Pendente" : inv.status}
                      </Badge>
                      {inv.status !== "paid" && (
                        <Button size="sm" variant="outline" onClick={() => markInvoicePaid(inv)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar paga
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Planos mais vendidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kpis.topPlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
                ) : (
                  kpis.topPlans.map(([name, count]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span>{name}</span>
                      <span className="font-medium">{count} assinantes</span>
                    </div>
                  ))
                )}
                <div className="border-t pt-3 mt-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Receita recorrente prevista (12m)</span><span className="font-medium">{formatBRL(kpis.arr)}</span></div>
                  <div className="flex justify-between"><span>Receita mensal recorrente</span><span className="font-medium">{formatBRL(kpis.mrr)}</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* DIALOG: Plan */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome do plano *</Label>
                  <Input
                    value={editingPlan.name || ""}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="Plano Silver"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={editingPlan.plan_type}
                    onValueChange={(v) => setEditingPlan({ ...editingPlan, plan_type: v as PlanType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hair">Só Cabelo</SelectItem>
                      <SelectItem value="beard">Só Barba</SelectItem>
                      <SelectItem value="hair_beard">Cabelo + Barba</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editingPlan.description || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  placeholder="Detalhes do plano..."
                />
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Valor mensal (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingPlan.monthly_price ?? 0}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, monthly_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Uso</Label>
                  <Select
                    value={editingPlan.usage_type}
                    onValueChange={(v) =>
                      setEditingPlan({
                        ...editingPlan,
                        usage_type: v as UsageType,
                        max_uses_per_month: v === "unlimited" ? null : editingPlan.max_uses_per_month || 4,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unlimited">Ilimitado</SelectItem>
                      <SelectItem value="limited">Limitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingPlan.usage_type === "limited" && (
                  <div>
                    <Label>Atendimentos/mês *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingPlan.max_uses_per_month ?? 4}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, max_uses_per_month: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-3 space-y-3">
                <h4 className="text-sm font-semibold">Benefícios</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Desconto em produtos (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editingPlan.benefits?.product_discount_percent ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          benefits: { ...editingPlan.benefits, product_discount_percent: parseFloat(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Cashback extra (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingPlan.benefits?.extra_cashback_percent ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          benefits: { ...editingPlan.benefits, extra_cashback_percent: parseFloat(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Prioridade na agenda</Label>
                  <Switch
                    checked={!!editingPlan.benefits?.priority_booking}
                    onCheckedChange={(v) =>
                      setEditingPlan({
                        ...editingPlan,
                        benefits: { ...editingPlan.benefits, priority_booking: v },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Observações / serviços exclusivos</Label>
                  <Textarea
                    placeholder="Ex.: Hidratação, sobrancelha, lavagem inclusa..."
                    value={editingPlan.benefits?.notes || ""}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        benefits: { ...editingPlan.benefits, notes: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="text-sm font-semibold">Métodos de pagamento aceitos</h4>
                {(["pix", "stripe", "in_person"] as PaymentMethod[]).map((m) => (
                  <div key={m} className="flex items-center justify-between">
                    <Label>{m === "pix" ? "PIX" : m === "stripe" ? "Cartão (Stripe)" : "Presencial"}</Label>
                    <Switch
                      checked={editingPlan.payment_methods?.includes(m) || false}
                      onCheckedChange={(v) => {
                        const current = editingPlan.payment_methods || [];
                        setEditingPlan({
                          ...editingPlan,
                          payment_methods: v ? [...current, m] : current.filter((x) => x !== m),
                        });
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Label>Plano ativo</Label>
                <Switch
                  checked={!!editingPlan.active}
                  onCheckedChange={(v) => setEditingPlan({ ...editingPlan, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePlan}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: New subscription */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova assinatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Select value={newSubCustomerId} onValueChange={setNewSubCustomerId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {customersList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={newSubPlanId} onValueChange={setNewSubPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {plans.filter((p) => p.active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {formatBRL(Number(p.monthly_price))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Método de pagamento</Label>
              <Select value={newSubPayment} onValueChange={(v) => setNewSubPayment(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">Presencial (já pago)</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="stripe">Cartão (Stripe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createSubscription}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
