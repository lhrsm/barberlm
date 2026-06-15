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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  Scissors,
  Gem,
  Star,
  Search,
  MoreVertical,
  Copy,
  Power,
  Sparkles,
  CalendarClock,
  Wallet,
  Store,
  Banknote,
  X,
  Filter,
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
  // Fidelidade & Premium
  participates_traditional_loyalty?: boolean;
  participates_cashback?: boolean;
  accumulates_premium_loyalty?: boolean;
  allows_product_discount?: boolean;
  agenda_priority?: boolean;
  exclusive_hours?: boolean;
  exclusive_days?: boolean;
  preferential_service?: boolean;
  included_benefits?: string[];
  barber_commission_type?: "fixed" | "percent" | "custom" | "none";
  barber_commission_value?: number;
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
  created_at?: string;
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
  hair: "Silver · Só Cabelo",
  beard: "Gold · Só Barba",
  hair_beard: "VIP · Cabelo + Barba",
  custom: "Personalizado",
};

const PLAN_TYPE_SHORT: Record<PlanType, string> = {
  hair: "Silver",
  beard: "Gold",
  hair_beard: "VIP",
  custom: "Personalizado",
};

const PLAN_VISUAL: Record<
  PlanType,
  { icon: any; border: string; glow: string; text: string; chip: string }
> = {
  hair: {
    icon: Scissors,
    border: "border-emerald-500/40 hover:border-emerald-400",
    glow: "hover:shadow-[0_8px_32px_rgba(16,185,129,0.18)]",
    text: "text-emerald-400",
    chip: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  beard: {
    icon: Crown,
    border: "border-amber-500/40 hover:border-amber-400",
    glow: "hover:shadow-[0_8px_32px_rgba(245,158,11,0.18)]",
    text: "text-amber-400",
    chip: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  hair_beard: {
    icon: Gem,
    border: "border-purple-500/40 hover:border-purple-400",
    glow: "hover:shadow-[0_8px_32px_rgba(168,85,247,0.18)]",
    text: "text-purple-400",
    chip: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  },
  custom: {
    icon: Star,
    border: "border-sky-500/40 hover:border-sky-400",
    glow: "hover:shadow-[0_8px_32px_rgba(56,189,248,0.18)]",
    text: "text-sky-400",
    chip: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativa", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  pending_payment: { label: "Pagamento Pendente", cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  past_due: { label: "Em Atraso", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
  canceled: { label: "Cancelada", cls: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30" },
  expired: { label: "Expirada", cls: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30" },
};

const SERVICE_OPTIONS = [
  "Corte",
  "Barba",
  "Combo Corte + Barba",
  "Sobrancelha",
  "Hidratação",
  "Pigmentação",
  "Outros",
];

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
    benefits: { priority_booking: false, exclusive_services: [] },
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
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersList, setCustomersList] = useState<
    { id: string; name: string; phone: string | null; cpf: string | null }[]
  >([]);

  // Filtros aba Planos
  const [planSearch, setPlanSearch] = useState("");
  const [planTypeFilter, setPlanTypeFilter] = useState<string>("all");
  const [planUsageFilter, setPlanUsageFilter] = useState<string>("all");
  const [planStatusFilter, setPlanStatusFilter] = useState<string>("all");

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
      supabase.from("customers").select("id,name,phone,cpf").eq("user_id", tenantId).order("name"),
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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const active = subs.filter((s) => s.status === "active");
    const mrr = active.reduce((acc, s) => acc + (Number(s.plan?.monthly_price) || 0), 0);
    const arr = mrr * 12;
    const total = subs.length || 1;
    const canceled = subs.filter((s) => s.status === "canceled");
    const retention = ((total - canceled.length) / total) * 100;
    const newThisMonth = subs.filter(
      (s) => new Date(s.created_at || s.started_at) >= monthStart
    ).length;

    const counts = new Map<string, number>();
    subs.forEach((s) => {
      if (s.plan?.name) counts.set(s.plan.name, (counts.get(s.plan.name) || 0) + 1);
    });
    const topPlans = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      activeCount: active.length,
      mrr,
      arr,
      retention,
      newThisMonth,
      topPlans,
    };
  }, [subs]);

  // Métricas por plano
  function planMetrics(planId: string) {
    const planSubs = subs.filter((s) => s.plan_id === planId && s.status === "active");
    const revenue = planSubs.reduce((acc, s) => acc + Number(s.plan?.monthly_price || 0), 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    const newThisMonth = subs.filter(
      (s) => s.plan_id === planId && new Date(s.created_at || s.started_at) >= monthStart
    ).length;
    return { subscribers: planSubs.length, revenue, newThisMonth };
  }

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (planSearch && !p.name.toLowerCase().includes(planSearch.toLowerCase())) return false;
      if (planTypeFilter !== "all" && p.plan_type !== planTypeFilter) return false;
      if (planUsageFilter !== "all" && p.usage_type !== planUsageFilter) return false;
      if (planStatusFilter === "active" && !p.active) return false;
      if (planStatusFilter === "inactive" && p.active) return false;
      return true;
    });
  }, [plans, planSearch, planTypeFilter, planUsageFilter, planStatusFilter]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customersList.slice(0, 8);
    const q = customerSearch.toLowerCase();
    return customersList
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.cpf || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customerSearch, customersList]);

  function clearPlanFilters() {
    setPlanSearch("");
    setPlanTypeFilter("all");
    setPlanUsageFilter("all");
    setPlanStatusFilter("all");
  }

  // === Plans CRUD ===
  function openNewPlan() {
    if (!tenantId) return;
    setEditingPlan(emptyPlan(tenantId));
    setPlanDialogOpen(true);
  }
  function openEditPlan(p: SubscriptionPlan) {
    setEditingPlan({ ...p, benefits: { exclusive_services: [], ...(p.benefits || {}) } });
    setPlanDialogOpen(true);
  }
  async function duplicatePlan(p: SubscriptionPlan) {
    if (!tenantId) return;
    const { id, created_at, ...rest } = p as any;
    const { error } = await supabase
      .from("subscription_plans")
      .insert({ ...rest, name: `${p.name} (cópia)`, tenant_id: tenantId });
    if (error) return toast.error("Erro ao duplicar: " + error.message);
    toast.success("Plano duplicado");
    loadAll();
  }
  async function togglePlanActive(p: SubscriptionPlan) {
    const { error } = await supabase
      .from("subscription_plans")
      .update({ active: !p.active })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.active ? "Plano desativado" : "Plano ativado");
    loadAll();
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
    const payload: any = { ...editingPlan, tenant_id: tenantId };
    const { error } = editingPlan.id
      ? await supabase.from("subscription_plans").update(payload).eq("id", editingPlan.id)
      : await supabase.from("subscription_plans").insert(payload);
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
  function openNewSub() {
    setNewSubCustomerId("");
    setNewSubPlanId("");
    setNewSubPayment("in_person");
    setCustomerSearch("");
    setSubDialogOpen(true);
  }

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
    toast.success("Assinatura criada com sucesso");
    setSubDialogOpen(false);
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
        <div className="min-h-[60vh] flex items-center justify-center bg-[#05070d]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
            <p className="text-zinc-500 text-sm font-medium">Carregando assinaturas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const selectedNewPlan = plans.find((p) => p.id === newSubPlanId);
  const selectedCustomer = customersList.find((c) => c.id === newSubCustomerId);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 grid place-items-center shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
                <CreditCard className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">Assinaturas</h1>
                <p className="text-sm text-zinc-400 mt-1 truncate">
                  Gerencie assinaturas, planos e assinantes da sua barbearia.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button
                onClick={openNewPlan}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_24px_rgba(16,185,129,0.45)] transition-all hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Plano
              </Button>
              <Button
                onClick={openNewSub}
                variant="outline"
                className="bg-[#0b0f17] border-zinc-700 text-white hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 font-bold transition-all hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4 mr-2" /> Nova Assinatura
              </Button>
            </div>
          </header>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Users}
              label="Assinantes Ativos"
              value={String(kpis.activeCount)}
              hint={`+${kpis.newThisMonth} este mês`}
              accent="emerald"
            />
            <KpiCard
              icon={DollarSign}
              label="MRR"
              value={formatBRL(kpis.mrr)}
              hint="Receita recorrente mensal"
              accent="sky"
            />
            <KpiCard
              icon={TrendingUp}
              label="ARR"
              value={formatBRL(kpis.arr)}
              hint="Receita anualizada"
              accent="purple"
            />
            <KpiCard
              icon={Sparkles}
              label="Taxa de Retenção"
              value={`${kpis.retention.toFixed(0)}%`}
              hint="Assinantes mantidos"
              accent="amber"
            />
          </div>

          {/* TABS */}
          <Tabs defaultValue="plans" className="w-full">
            <TabsList className="bg-[#0b0f17] border border-zinc-800/80 p-1.5 h-auto rounded-2xl gap-1 flex flex-wrap">
              {[
                { v: "plans", label: "Planos", icon: Crown },
                { v: "subscribers", label: "Assinantes", icon: Users },
                { v: "invoices", label: "Cobranças", icon: Receipt },
                { v: "reports", label: "Relatórios", icon: TrendingUp },
                { v: "settings", label: "Configurações", icon: Wallet },
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

            {/* === PLANS === */}
            <TabsContent value="plans" className="mt-6 space-y-6">
              {/* FILTROS */}
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                    Buscar plano
                  </Label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={planSearch}
                      onChange={(e) => setPlanSearch(e.target.value)}
                      placeholder="Nome do plano..."
                      className="pl-9 bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-emerald-500/60 focus-visible:ring-emerald-500/20 h-10"
                    />
                  </div>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                    Tipo
                  </Label>
                  <Select value={planTypeFilter} onValueChange={setPlanTypeFilter}>
                    <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-10 focus:border-emerald-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="hair">Silver</SelectItem>
                      <SelectItem value="beard">Gold</SelectItem>
                      <SelectItem value="hair_beard">VIP</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                    Uso
                  </Label>
                  <Select value={planUsageFilter} onValueChange={setPlanUsageFilter}>
                    <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-10 focus:border-emerald-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="unlimited">Ilimitado</SelectItem>
                      <SelectItem value="limited">Limitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                    Status
                  </Label>
                  <Select value={planStatusFilter} onValueChange={setPlanStatusFilter}>
                    <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-10 focus:border-emerald-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1">
                  <Button
                    variant="ghost"
                    onClick={clearPlanFilters}
                    className="w-full h-10 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/5 text-xs font-bold"
                  >
                    <Filter className="h-3.5 w-3.5 mr-1" /> Limpar
                  </Button>
                </div>
              </div>

              {/* PLAN CARDS */}
              {filteredPlans.length === 0 ? (
                <EmptyState
                  icon={Crown}
                  title="Nenhum plano encontrado"
                  description="Comece criando seu primeiro plano de assinatura."
                  action={
                    <Button
                      onClick={openNewPlan}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Criar Plano
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4">
                  {filteredPlans.map((p) => {
                    const v = PLAN_VISUAL[p.plan_type];
                    const Icon = v.icon;
                    const m = planMetrics(p.id);
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "group bg-[#0b0f17] border-2 rounded-2xl p-5 md:p-6 transition-all duration-300 hover:-translate-y-0.5",
                          v.border,
                          v.glow,
                          !p.active && "opacity-50"
                        )}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-5 items-center">
                          {/* Icon + Title */}
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className={cn(
                                "shrink-0 h-14 w-14 rounded-2xl grid place-items-center border-2 transition-transform group-hover:scale-105",
                                v.chip,
                                v.border
                              )}
                            >
                              <Icon className={cn("h-7 w-7", v.text)} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-black truncate">{p.name}</h3>
                                <Badge
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-wider border-0",
                                    p.active
                                      ? "bg-emerald-500/15 text-emerald-400"
                                      : "bg-zinc-500/15 text-zinc-400"
                                  )}
                                >
                                  {p.active ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              <p className={cn("text-xs font-bold uppercase tracking-wider mt-1", v.text)}>
                                {PLAN_TYPE_LABEL[p.plan_type]}
                              </p>
                              {p.description && (
                                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{p.description}</p>
                              )}
                            </div>
                          </div>

                          {/* Metrics grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Metric
                              label="Preço"
                              value={formatBRL(Number(p.monthly_price))}
                              suffix="/mês"
                              strong
                            />
                            <Metric
                              label="Uso"
                              value={
                                p.usage_type === "unlimited"
                                  ? "Ilimitado"
                                  : `${p.max_uses_per_month} cortes`
                              }
                            />
                            <Metric label="Assinantes" value={`${m.subscribers}`} />
                            <Metric
                              label="Receita"
                              value={formatBRL(m.revenue)}
                              hint={m.newThisMonth > 0 ? `+${m.newThisMonth} este mês` : undefined}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-10 w-10 rounded-xl text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                                >
                                  <MoreVertical className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-[#0b0f17] border-zinc-800 text-white"
                              >
                                <DropdownMenuItem
                                  onClick={() => openEditPlan(p)}
                                  className="focus:bg-emerald-500/10 focus:text-emerald-400"
                                >
                                  <Pencil className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => duplicatePlan(p)}
                                  className="focus:bg-emerald-500/10 focus:text-emerald-400"
                                >
                                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => togglePlanActive(p)}
                                  className="focus:bg-emerald-500/10 focus:text-emerald-400"
                                >
                                  <Power className="h-4 w-4 mr-2" />{" "}
                                  {p.active ? "Desativar" : "Ativar"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-800" />
                                <DropdownMenuItem
                                  onClick={() => deletePlan(p.id)}
                                  className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* === SUBSCRIBERS === */}
            <TabsContent value="subscribers" className="mt-6 space-y-3">
              {subs.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum assinante ainda"
                  description="Crie uma nova assinatura para começar."
                />
              ) : (
                <div className="space-y-2">
                  {subs.map((s) => {
                    const status = STATUS_LABEL[s.status] || {
                      label: s.status,
                      cls: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
                    };
                    const v = s.plan ? PLAN_VISUAL[s.plan.plan_type] : PLAN_VISUAL.custom;
                    return (
                      <div
                        key={s.id}
                        className="bg-[#0b0f17] border border-zinc-800/80 hover:border-emerald-500/30 rounded-2xl p-5 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={cn(
                              "h-11 w-11 rounded-xl grid place-items-center shrink-0",
                              v.chip
                            )}
                          >
                            <Users className={cn("h-5 w-5", v.text)} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold truncate">{s.customer?.name || "Cliente"}</div>
                            <div className="text-xs text-zinc-500 mt-0.5 truncate">
                              {s.plan?.name} · {formatBRL(Number(s.plan?.monthly_price || 0))}/mês
                            </div>
                            <div className="text-xs text-zinc-600 mt-1 flex items-center gap-1.5">
                              <CalendarClock className="h-3 w-3" />
                              Até {new Date(s.current_period_end).toLocaleDateString("pt-BR")}
                              {s.plan?.usage_type === "limited" &&
                                ` · ${s.uses_this_period}/${s.plan.max_uses_per_month} usos`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                              status.cls
                            )}
                          >
                            {status.label}
                          </span>
                          {s.status !== "canceled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelSubscription(s.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-bold"
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* === INVOICES === */}
            <TabsContent value="invoices" className="mt-6 space-y-2">
              {invoices.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Nenhuma cobrança"
                  description="As cobranças aparecerão aqui após as assinaturas."
                />
              ) : (
                invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-[#0b0f17] border border-zinc-800/80 hover:border-emerald-500/30 rounded-2xl p-5 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-11 w-11 rounded-xl grid place-items-center bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        <Receipt className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate">
                          {inv.customer?.name || "Cliente"} ·{" "}
                          <span className="text-emerald-400">{formatBRL(Number(inv.amount))}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Venc.: {new Date(inv.due_date).toLocaleDateString("pt-BR")} ·{" "}
                          {paymentMethodLabel(inv.payment_method)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          inv.status === "paid"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : inv.status === "pending"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-red-500/15 text-red-400 border border-red-500/30"
                        )}
                      >
                        {inv.status === "paid"
                          ? "Paga"
                          : inv.status === "pending"
                          ? "Pendente"
                          : inv.status}
                      </span>
                      {inv.status !== "paid" && (
                        <Button
                          size="sm"
                          onClick={() => markInvoicePaid(inv)}
                          className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold text-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar paga
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* === REPORTS === */}
            <TabsContent value="reports" className="mt-6">
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-lg font-black mb-1">Planos mais vendidos</h3>
                <p className="text-xs text-zinc-500 mb-5">Ranking por número de assinantes.</p>
                {kpis.topPlans.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sem dados ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {kpis.topPlans.map(([name, count], i) => {
                      const max = kpis.topPlans[0][1];
                      const pct = (count / max) * 100;
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-bold">
                              <span className="text-emerald-400 mr-2">#{i + 1}</span> {name}
                            </span>
                            <span className="text-zinc-400 font-bold">{count} assinantes</span>
                          </div>
                          <div className="h-2 bg-[#05070d] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="border-t border-zinc-800 pt-4 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#05070d] rounded-xl p-4 border border-zinc-800/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Receita Mensal Recorrente
                    </p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{formatBRL(kpis.mrr)}</p>
                  </div>
                  <div className="bg-[#05070d] rounded-xl p-4 border border-zinc-800/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Receita Prevista (12m)
                    </p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{formatBRL(kpis.arr)}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* === SETTINGS === */}
            <TabsContent value="settings" className="mt-6">
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-black">Automações</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Notificações automáticas configuradas para suas assinaturas.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: "5 dias antes do vencimento", on: true },
                    { label: "1 dia antes do vencimento", on: true },
                    { label: "Assinatura vencida", on: true },
                    { label: "Renovação realizada", on: true },
                  ].map((a) => (
                    <div
                      key={a.label}
                      className="flex items-center justify-between bg-[#05070d] border border-zinc-800/60 rounded-xl p-4"
                    >
                      <span className="text-sm font-bold">{a.label}</span>
                      <Switch
                        defaultChecked={a.on}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* DIALOG: Plan */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-[#0b0f17] border border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Crown className="h-6 w-6 text-emerald-400" />
              {editingPlan?.id ? "Editar plano" : "Novo plano"}
            </DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-5">
              {/* DADOS GERAIS */}
              <Block title="Dados gerais">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Nome do plano *">
                    <Input
                      value={editingPlan.name || ""}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      placeholder="Plano Silver"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Tipo">
                    <Select
                      value={editingPlan.plan_type}
                      onValueChange={(v) =>
                        setEditingPlan({ ...editingPlan, plan_type: v as PlanType })
                      }
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hair">Silver · Só Cabelo</SelectItem>
                        <SelectItem value="beard">Gold · Só Barba</SelectItem>
                        <SelectItem value="hair_beard">VIP · Cabelo + Barba</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Descrição">
                  <Textarea
                    value={editingPlan.description || ""}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, description: e.target.value })
                    }
                    placeholder="Resumo do que o assinante recebe..."
                    className={cn(inputCls, "min-h-[80px]")}
                  />
                </Field>
              </Block>

              {/* CONFIGURAÇÕES DE USO */}
              <Block title="Configurações de uso">
                <div className="grid md:grid-cols-3 gap-4">
                  <Field label="Valor mensal (R$) *">
                    <Input
                      type="number"
                      step="0.01"
                      value={editingPlan.monthly_price ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          monthly_price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Tipo de uso">
                    <Select
                      value={editingPlan.usage_type}
                      onValueChange={(v) =>
                        setEditingPlan({
                          ...editingPlan,
                          usage_type: v as UsageType,
                          max_uses_per_month:
                            v === "unlimited" ? null : editingPlan.max_uses_per_month || 4,
                        })
                      }
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unlimited">Ilimitado</SelectItem>
                        <SelectItem value="limited">Limitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {editingPlan.usage_type === "limited" && (
                    <Field label="Qtd. máx. de atendimentos *">
                      <Input
                        type="number"
                        min={1}
                        value={editingPlan.max_uses_per_month ?? 4}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            max_uses_per_month: parseInt(e.target.value) || 1,
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                  )}
                </div>
              </Block>

              {/* BENEFÍCIOS */}
              <Block title="Benefícios">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Desconto em produtos (%)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editingPlan.benefits?.product_discount_percent ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          benefits: {
                            ...editingPlan.benefits,
                            product_discount_percent: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Cashback extra (%)">
                    <Input
                      type="number"
                      min={0}
                      value={editingPlan.benefits?.extra_cashback_percent ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          benefits: {
                            ...editingPlan.benefits,
                            extra_cashback_percent: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>
                <ToggleRow
                  label="Prioridade na agenda"
                  checked={!!editingPlan.benefits?.priority_booking}
                  onChange={(v) =>
                    setEditingPlan({
                      ...editingPlan,
                      benefits: { ...editingPlan.benefits, priority_booking: v },
                    })
                  }
                />
                <Field label="Observações / Serviços exclusivos">
                  <Textarea
                    placeholder="Ex.: Hidratação inclusa, atendimento prioritário aos sábados..."
                    value={editingPlan.benefits?.notes || ""}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        benefits: { ...editingPlan.benefits, notes: e.target.value },
                      })
                    }
                    className={cn(inputCls, "min-h-[100px]")}
                  />
                </Field>
              </Block>

              {/* SERVIÇOS INCLUÍDOS */}
              <Block title="Serviços incluídos">
                <div className="grid md:grid-cols-2 gap-2">
                  {SERVICE_OPTIONS.map((srv) => {
                    const current = editingPlan.benefits?.exclusive_services || [];
                    const on = current.includes(srv);
                    return (
                      <ToggleRow
                        key={srv}
                        label={srv}
                        checked={on}
                        onChange={(v) =>
                          setEditingPlan({
                            ...editingPlan,
                            benefits: {
                              ...editingPlan.benefits,
                              exclusive_services: v
                                ? [...current, srv]
                                : current.filter((s) => s !== srv),
                            },
                          })
                        }
                      />
                    );
                  })}
                </div>
              </Block>

              {/* MÉTODOS DE PAGAMENTO */}
              <Block title="Métodos de pagamento aceitos">
                {(["pix", "stripe", "in_person"] as PaymentMethod[]).map((m) => (
                  <ToggleRow
                    key={m}
                    label={m === "pix" ? "PIX" : m === "stripe" ? "Cartão (Stripe)" : "Presencial"}
                    checked={editingPlan.payment_methods?.includes(m) || false}
                    onChange={(v) => {
                      const current = editingPlan.payment_methods || [];
                      setEditingPlan({
                        ...editingPlan,
                        payment_methods: v ? [...current, m] : current.filter((x) => x !== m),
                      });
                    }}
                  />
                ))}
              </Block>

              {/* STATUS */}
              <Block title="Status">
                <ToggleRow
                  label="Plano ativo"
                  checked={!!editingPlan.active}
                  onChange={(v) => setEditingPlan({ ...editingPlan, active: v })}
                />
              </Block>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPlanDialogOpen(false)}
              className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={savePlan}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
            >
              Salvar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: New subscription */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-[#0b0f17] border border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-emerald-400" />
              Nova assinatura
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* CLIENTE */}
            <Block title="Cliente">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setNewSubCustomerId("");
                  }}
                  placeholder="Buscar por nome, telefone ou CPF..."
                  className={cn(inputCls, "pl-9")}
                />
              </div>
              {!newSubCustomerId && customerSearch && (
                <div className="border border-zinc-800 rounded-xl bg-[#05070d] max-h-52 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-3">Nenhum cliente encontrado.</p>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setNewSubCustomerId(c.id);
                          setCustomerSearch(c.name);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors border-b border-zinc-800/60 last:border-0"
                      >
                        <div className="text-sm font-bold">{c.name}</div>
                        <div className="text-xs text-zinc-500">
                          {c.phone || "—"} {c.cpf ? `· ${c.cpf}` : ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedCustomer && newSubCustomerId && (
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-emerald-400">{selectedCustomer.name}</div>
                    <div className="text-xs text-zinc-500">{selectedCustomer.phone || ""}</div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setNewSubCustomerId("");
                      setCustomerSearch("");
                    }}
                    className="h-8 w-8 text-zinc-400 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Block>

            {/* PLANO */}
            <Block title="Plano">
              {plans.filter((p) => p.active).length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum plano ativo disponível.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {plans
                    .filter((p) => p.active)
                    .map((p) => {
                      const v = PLAN_VISUAL[p.plan_type];
                      const Icon = v.icon;
                      const selected = newSubPlanId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setNewSubPlanId(p.id)}
                          className={cn(
                            "text-left p-4 rounded-2xl border-2 transition-all bg-[#05070d]",
                            selected
                              ? "border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                              : "border-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className={cn(
                                "h-10 w-10 rounded-xl grid place-items-center border",
                                v.chip
                              )}
                            >
                              <Icon className={cn("h-5 w-5", v.text)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-black truncate">{p.name}</div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                {PLAN_TYPE_SHORT[p.plan_type]}
                              </div>
                            </div>
                            {selected && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                          </div>
                          <div className="text-xl font-black text-emerald-400">
                            {formatBRL(Number(p.monthly_price))}
                            <span className="text-xs font-normal text-zinc-500">/mês</span>
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {p.usage_type === "unlimited"
                              ? "Atendimentos ilimitados"
                              : `${p.max_uses_per_month} atendimentos/mês`}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </Block>

            {/* MÉTODO DE PAGAMENTO */}
            <Block title="Método de pagamento">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: "pix", label: "PIX", icon: Banknote },
                  { v: "stripe", label: "Cartão", icon: CreditCard },
                  { v: "in_person", label: "Presencial", icon: Store },
                ].map((m) => {
                  const selected = newSubPayment === m.v;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.v}
                      onClick={() => setNewSubPayment(m.v as PaymentMethod)}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        selected
                          ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                          : "bg-[#05070d] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-sm font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </Block>

            {/* RESUMO */}
            {selectedNewPlan && (
              <Block title="Resumo">
                <div className="bg-[#05070d] border border-emerald-500/20 rounded-xl p-4 space-y-2 text-sm">
                  <Row label="Plano" value={selectedNewPlan.name} />
                  <Row
                    label="Valor"
                    value={`${formatBRL(Number(selectedNewPlan.monthly_price))}/mês`}
                  />
                  <Row label="Pagamento" value={paymentMethodLabel(newSubPayment)} />
                  <Row
                    label="Uso"
                    value={
                      selectedNewPlan.usage_type === "unlimited"
                        ? "Ilimitado"
                        : `${selectedNewPlan.max_uses_per_month} atendimentos/mês`
                    }
                  />
                  {selectedNewPlan.benefits?.notes && (
                    <Row label="Benefícios" value={selectedNewPlan.benefits.notes} />
                  )}
                </div>
              </Block>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSubDialogOpen(false)}
              className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800 hover:text-white hover:border-zinc-600"
            >
              Cancelar
            </Button>
            <Button
              onClick={createSubscription}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
            >
              Criar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

/* ===================== Subcomponents ===================== */

const inputCls =
  "bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-emerald-500/60 focus-visible:ring-emerald-500/20 h-10 transition-colors";

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
  const accents: Record<string, { bg: string; text: string; border: string; glow: string }> = {
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
      <div className="text-3xl font-black tracking-tight">{value}</div>
      {hint && (
        <div className={cn("text-xs mt-1 font-bold", a.text)}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  hint,
  strong,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</div>
      <div
        className={cn(
          "mt-1",
          strong ? "text-lg font-black text-emerald-400" : "text-sm font-bold text-white"
        )}
      >
        {value}
        {suffix && <span className="text-[10px] font-normal text-zinc-500">{suffix}</span>}
      </div>
      {hint && <div className="text-[10px] text-emerald-400 font-bold mt-0.5">{hint}</div>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0b0f17] border border-dashed border-zinc-800 rounded-2xl py-16 px-6 text-center">
      <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-500/10 grid place-items-center mb-4">
        <Icon className="h-8 w-8 text-emerald-400 opacity-70" />
      </div>
      <h3 className="text-lg font-black">{title}</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4 max-w-md mx-auto">{description}</p>
      {action}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#05070d]/60 border border-zinc-800/60 rounded-2xl p-4 md:p-5 space-y-4">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-zinc-400">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-[#0b0f17] border border-zinc-800/60 rounded-xl px-4 py-3">
      <span className="text-sm font-bold">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-emerald-500"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="font-bold text-right">{value}</span>
    </div>
  );
}

function paymentMethodLabel(m: string) {
  return m === "pix" ? "PIX" : m === "stripe" ? "Cartão" : "Presencial";
}
