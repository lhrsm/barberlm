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
  Activity,
  Pause,
  Play,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  paused_at?: string | null;
  pause_reason?: string | null;
  pause_until?: string | null;
  resumed_at?: string | null;
  pause_notes?: string | null;
  total_paused_days?: number | null;
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
  paused: { label: "Pausada", cls: "bg-blue-500/15 text-blue-300 border border-blue-500/30" },
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
    participates_traditional_loyalty: false,
    participates_cashback: false,
    accumulates_premium_loyalty: true,
    allows_product_discount: false,
    agenda_priority: false,
    exclusive_hours: false,
    exclusive_days: false,
    preferential_service: false,
    included_benefits: [],
    barber_commission_type: "fixed",
    barber_commission_value: 0,
  };
}


function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const tenantId = user?.id;

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subs, setSubs] = useState<CustomerSub[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicesList, setServicesList] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [editingPlanServices, setEditingPlanServices] = useState<Record<string, { included: boolean; max_uses_per_period: number | null }>>({});
  const [usageLogs, setUsageLogs] = useState<any[]>([]);

  // Filtros aba Uso
  const [usageRange, setUsageRange] = useState<"7" | "30" | "90" | "all" | "custom">("30");
  const [usageFrom, setUsageFrom] = useState("");
  const [usageTo, setUsageTo] = useState("");
  const [usagePlanFilter, setUsagePlanFilter] = useState<string>("all");
  const [usageServiceFilter, setUsageServiceFilter] = useState<string>("all");
  const [usageSearch, setUsageSearch] = useState("");

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [newSubCustomerId, setNewSubCustomerId] = useState("");
  const [newSubPlanId, setNewSubPlanId] = useState("");
  const [newSubPayment, setNewSubPayment] = useState<PaymentMethod>("in_person");
  const [newSubCouponCode, setNewSubCouponCode] = useState("");
  const [newSubCoupon, setNewSubCoupon] = useState<any | null>(null);
  const [newSubCouponLoading, setNewSubCouponLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersList, setCustomersList] = useState<
    { id: string; name: string; phone: string | null; cpf: string | null }[]
  >([]);

  // Filtros aba Planos
  const [planSearch, setPlanSearch] = useState("");
  const [planTypeFilter, setPlanTypeFilter] = useState<string>("all");
  const [planUsageFilter, setPlanUsageFilter] = useState<string>("all");
  const [planStatusFilter, setPlanStatusFilter] = useState<string>("all");

  // Pause modal
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pauseTarget, setPauseTarget] = useState<CustomerSub | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseUntil, setPauseUntil] = useState("");
  const [pauseNotes, setPauseNotes] = useState("");

  // Change plan modal
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [changeTarget, setChangeTarget] = useState<CustomerSub | null>(null);
  const [changeNewPlanId, setChangeNewPlanId] = useState<string>("");
  const [changePreview, setChangePreview] = useState<any>(null);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeApplyWallet, setChangeApplyWallet] = useState(true);
  const [changeNotes, setChangeNotes] = useState("");
  const [planChanges, setPlanChanges] = useState<any[]>([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<CustomerSub | null>(null);

  async function loadAll() {
    if (!tenantId) return;
    setLoading(true);
    const [plansRes, subsRes, invRes, custRes, svcRes, usageRes, changesRes] = await Promise.all([
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
      supabase.from("services").select("id,name,price").eq("user_id", tenantId).order("name"),
      supabase
        .from("subscription_usage_logs" as any)
        .select("*, services(name, price), customer:customers(id,name,phone), plan:subscription_plans(id,name,monthly_price)")
        .eq("tenant_id", tenantId)
        .order("used_at", { ascending: false })
        .limit(500),
      supabase
        .from("subscription_plan_changes" as any)
        .select("*, customer:customers(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (plansRes.data) setPlans(plansRes.data as any);
    if (subsRes.data) setSubs(subsRes.data as any);
    if (invRes.data) setInvoices(invRes.data as any);
    if (custRes.data) setCustomersList(custRes.data as any);
    if (svcRes.data) setServicesList(svcRes.data as any);
    if (usageRes.data) setUsageLogs(usageRes.data as any);
    if (changesRes.data) setPlanChanges(changesRes.data as any);
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
    const canceledThisMonth = subs.filter(
      (s: any) => s.status === "canceled" && s.canceled_at && new Date(s.canceled_at) >= monthStart
    ).length;
    const activeAtStart = active.length + canceledThisMonth;
    const churn = activeAtStart > 0 ? (canceledThisMonth / activeAtStart) * 100 : 0;

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
      churn,
      canceledThisMonth,
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
    setEditingPlanServices({});
    setPlanDialogOpen(true);
  }
  async function openEditPlan(p: SubscriptionPlan) {
    setEditingPlan({ ...p, benefits: { exclusive_services: [], ...(p.benefits || {}) } });
    setEditingPlanServices({});
    setPlanDialogOpen(true);
    const { data } = await (supabase as any)
      .from("subscription_plan_services")
      .select("service_id,max_uses_per_period")
      .eq("plan_id", p.id);
    if (data) {
      const map: Record<string, { included: boolean; max_uses_per_period: number | null }> = {};
      for (const row of data) {
        map[row.service_id] = { included: true, max_uses_per_period: row.max_uses_per_period };
      }
      setEditingPlanServices(map);
    }
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
    let planId = editingPlan.id;
    if (planId) {
      const { error } = await supabase.from("subscription_plans").update(payload).eq("id", planId);
      if (error) { toast.error("Erro ao salvar plano: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("subscription_plans").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao salvar plano: " + error.message); return; }
      planId = data.id;
    }

    // Sync plan ↔ services junction
    if (planId) {
      await (supabase as any).from("subscription_plan_services").delete().eq("plan_id", planId);
      const rows = Object.entries(editingPlanServices)
        .filter(([, v]) => v.included)
        .map(([service_id, v]) => ({
          tenant_id: tenantId,
          plan_id: planId,
          service_id,
          max_uses_per_period: v.max_uses_per_period,
        }));
      if (rows.length > 0) {
        const { error: linkErr } = await (supabase as any).from("subscription_plan_services").insert(rows);
        if (linkErr) toast.error("Plano salvo, mas houve erro ao vincular serviços: " + linkErr.message);
      }
    }

    toast.success("Plano salvo");
    setPlanDialogOpen(false);
    setEditingPlan(null);
    setEditingPlanServices({});
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
    setNewSubCouponCode("");
    setNewSubCoupon(null);
    setSubDialogOpen(true);
  }

  async function applyNewSubCoupon() {
    if (!tenantId || !newSubCouponCode.trim() || !newSubPlanId) {
      toast.error("Selecione um plano antes de aplicar o cupom");
      return;
    }
    const plan = plans.find((p) => p.id === newSubPlanId);
    if (!plan) return;
    setNewSubCouponLoading(true);
    const { data, error } = await supabase.rpc("validate_subscription_coupon" as any, {
      p_tenant_id: tenantId,
      p_code: newSubCouponCode.trim(),
      p_plan_price: Number(plan.monthly_price),
    });
    setNewSubCouponLoading(false);
    const res = data as any;
    if (error || !res?.valid) {
      toast.error(res?.error || error?.message || "Cupom inválido");
      setNewSubCoupon(null);
      return;
    }
    setNewSubCoupon(res);
    setNewSubCouponCode("");
    toast.success("Cupom aplicado");
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

    const monthlyPrice = Number(plan.monthly_price);
    const couponDiscount = newSubCoupon?.valid ? Number(newSubCoupon.discount_amount || 0) : 0;
    const firstInvoiceAmount = newSubCoupon?.valid
      ? Number(newSubCoupon.final_amount ?? Math.max(0, monthlyPrice - couponDiscount))
      : monthlyPrice;

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
        ...(newSubCoupon?.valid
          ? {
              coupon_id: newSubCoupon.coupon_id,
              coupon_code: newSubCoupon.coupon_code,
              coupon_discount: couponDiscount,
              coupon_first_month_only: !!newSubCoupon.first_month_only,
            }
          : {}),
      } as any)
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
      amount: firstInvoiceAmount,
      status: newSubPayment === "in_person" ? "paid" : "pending",
      payment_method: newSubPayment,
      due_date: now.toISOString(),
      paid_at: newSubPayment === "in_person" ? now.toISOString() : null,
      ...(newSubCoupon?.valid
        ? {
            coupon_id: newSubCoupon.coupon_id,
            coupon_code: newSubCoupon.coupon_code,
            discount_amount: couponDiscount,
            original_amount: monthlyPrice,
          }
        : {}),
    } as any);

    if (newSubCoupon?.valid && newSubCoupon.coupon_id) {
      await supabase.rpc("increment" as any, {}).then(() => {}).catch(() => {});
      // Best-effort increment of used_count
      const { data: cpRow } = await supabase
        .from("coupons")
        .select("used_count")
        .eq("id", newSubCoupon.coupon_id)
        .maybeSingle();
      await supabase
        .from("coupons")
        .update({ used_count: (Number(cpRow?.used_count) || 0) + 1 })
        .eq("id", newSubCoupon.coupon_id);
    }

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

  function openPauseDialog(sub: CustomerSub) {
    setPauseTarget(sub);
    setPauseReason("");
    setPauseUntil("");
    setPauseNotes("");
    setPauseDialogOpen(true);
  }

  async function confirmPause() {
    if (!pauseTarget) return;
    const { data, error } = await supabase.rpc("pause_customer_subscription" as any, {
      p_subscription_id: pauseTarget.id,
      p_reason: pauseReason || null,
      p_pause_until: pauseUntil ? new Date(pauseUntil).toISOString() : null,
      p_notes: pauseNotes || null,
    });
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error || error?.message || "Erro ao pausar");
      return;
    }
    toast.success("Assinatura pausada");
    setPauseDialogOpen(false);
    loadAll();
  }

  async function resumeSubscription(id: string) {
    if (!confirm("Retomar esta assinatura?")) return;
    const { data, error } = await supabase.rpc("resume_customer_subscription" as any, {
      p_subscription_id: id,
    });
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error || error?.message || "Erro ao retomar");
      return;
    }
    const days = (data as any)?.paused_days ?? 0;
    toast.success(`Assinatura retomada${days ? ` (+${days} dias)` : ""}`);
    loadAll();
  }

  // === Trocar plano (pró-rata) ===
  function openChangeDialog(sub: CustomerSub) {
    setChangeTarget(sub);
    setChangeNewPlanId("");
    setChangePreview(null);
    setChangeNotes("");
    setChangeApplyWallet(true);
    setChangeDialogOpen(true);
  }

  async function loadChangePreview(newPlanId: string) {
    if (!changeTarget || !newPlanId) {
      setChangePreview(null);
      return;
    }
    setChangeLoading(true);
    const { data, error } = await supabase.rpc("preview_subscription_plan_change" as any, {
      p_subscription_id: changeTarget.id,
      p_new_plan_id: newPlanId,
    });
    setChangeLoading(false);
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error || error?.message || "Erro ao calcular pró-rata");
      setChangePreview(null);
      return;
    }
    setChangePreview(data);
  }

  async function confirmChangePlan() {
    if (!changeTarget || !changeNewPlanId || !changePreview) return;
    const { data, error } = await supabase.rpc("change_subscription_plan" as any, {
      p_subscription_id: changeTarget.id,
      p_new_plan_id: changeNewPlanId,
      p_payment_method: changeTarget.payment_method || "in_person",
      p_apply_credit_to_wallet: changeApplyWallet,
      p_notes: changeNotes || null,
    });
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error || error?.message || "Erro ao trocar plano");
      return;
    }
    const net = Number((data as any)?.net_amount || 0);
    if (net > 0) toast.success(`Plano alterado · cobrança de ${formatBRL(net)} gerada`);
    else if (net < 0) toast.success(`Plano alterado · crédito de ${formatBRL(Math.abs(net))} ${changeApplyWallet ? "na carteira" : "registrado"}`);
    else toast.success("Plano alterado sem diferença");
    setChangeDialogOpen(false);
    loadAll();
  }

  function openHistoryDialog(sub: CustomerSub) {
    setHistoryTarget(sub);
    setHistoryDialogOpen(true);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              label="Retenção"
              value={`${kpis.retention.toFixed(0)}%`}
              hint="Assinantes mantidos"
              accent="amber"
            />
            <KpiCard
              icon={XCircle}
              label="Churn (mês)"
              value={`${kpis.churn.toFixed(1)}%`}
              hint={`${kpis.canceledThisMonth} cancelaram`}
              accent="rose"
            />
          </div>

          {/* TABS */}
          <Tabs defaultValue="plans" className="w-full">
            <TabsList className="bg-[#0b0f17] border border-zinc-800/80 p-1.5 h-auto rounded-2xl gap-1 flex flex-wrap">
              {[
                { v: "plans", label: "Planos", icon: Crown },
                { v: "subscribers", label: "Assinantes", icon: Users },
                { v: "invoices", label: "Cobranças", icon: Receipt },
                { v: "usage", label: "Uso", icon: Activity },
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
                            {s.status === "paused" && (
                              <div className="text-[11px] text-blue-300 mt-1 flex items-center gap-1.5">
                                <Pause className="h-3 w-3" />
                                Pausada{s.pause_reason ? ` · ${s.pause_reason}` : ""}
                                {s.pause_until ? ` · retorno ${new Date(s.pause_until).toLocaleDateString("pt-BR")}` : ""}
                              </div>
                            )}
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
                          {s.status === "paused" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resumeSubscription(s.id)}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-xs font-bold"
                            >
                              <Play className="h-3.5 w-3.5 mr-1" /> Retomar
                            </Button>
                          )}
                          {["active", "pending_payment", "past_due"].includes(s.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openChangeDialog(s)}
                                className="text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 text-xs font-bold"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Trocar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openPauseDialog(s)}
                                className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 text-xs font-bold"
                              >
                                <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openHistoryDialog(s)}
                            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-500/10 text-xs font-bold"
                          >
                            <History className="h-3.5 w-3.5 mr-1" /> Histórico
                          </Button>
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

            {/* === USAGE === */}
            <TabsContent value="usage" className="mt-6 space-y-6">
              {(() => {
                // Filter logs
                const now = new Date();
                let cutoff: Date | null = null;
                if (usageRange === "7") cutoff = subDays(now, 7);
                else if (usageRange === "30") cutoff = subDays(now, 30);
                else if (usageRange === "90") cutoff = subDays(now, 90);

                const filtered = usageLogs.filter((l: any) => {
                  if (!l.used_at) return true;
                  const d = parseISO(l.used_at);
                  if (cutoff && d < cutoff) return false;
                  if (usageRange === "custom") {
                    if (usageFrom && d < parseISO(usageFrom)) return false;
                    if (usageTo && d > parseISO(usageTo + "T23:59:59")) return false;
                  }
                  if (usagePlanFilter !== "all" && l.subscription_plan_id !== usagePlanFilter) return false;
                  if (usageServiceFilter !== "all" && l.service_id !== usageServiceFilter) return false;
                  if (usageSearch.trim()) {
                    const q = usageSearch.toLowerCase();
                    const hay = `${l.customer?.name || ""} ${l.customer?.phone || ""} ${l.services?.name || ""}`.toLowerCase();
                    if (!hay.includes(q)) return false;
                  }
                  return true;
                });

                const totalCovered = filtered.reduce((s: number, l: any) => s + Number(l.covered_amount || 0), 0);
                const totalExtra = filtered.reduce((s: number, l: any) => s + Number(l.extra_amount || 0), 0);
                const uniqueCustomers = new Set(filtered.map((l: any) => l.customer_id)).size;

                // Top services
                const svcMap = new Map<string, { name: string; count: number; covered: number }>();
                filtered.forEach((l: any) => {
                  const k = l.service_id || "—";
                  const name = l.services?.name || "Outros";
                  const cur = svcMap.get(k) || { name, count: 0, covered: 0 };
                  cur.count += 1;
                  cur.covered += Number(l.covered_amount || 0);
                  svcMap.set(k, cur);
                });
                const topServices = Array.from(svcMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);

                // Top customers
                const custMap = new Map<string, { name: string; count: number; covered: number }>();
                filtered.forEach((l: any) => {
                  const k = l.customer_id || "—";
                  const name = l.customer?.name || "Cliente";
                  const cur = custMap.get(k) || { name, count: 0, covered: 0 };
                  cur.count += 1;
                  cur.covered += Number(l.covered_amount || 0);
                  custMap.set(k, cur);
                });
                const topCustomers = Array.from(custMap.values()).sort((a, b) => b.covered - a.covered).slice(0, 5);

                // Top plans
                const planMap = new Map<string, { name: string; count: number; covered: number }>();
                filtered.forEach((l: any) => {
                  const k = l.subscription_plan_id || "—";
                  const name = l.plan?.name || "Sem plano";
                  const cur = planMap.get(k) || { name, count: 0, covered: 0 };
                  cur.count += 1;
                  cur.covered += Number(l.covered_amount || 0);
                  planMap.set(k, cur);
                });
                const topPlans = Array.from(planMap.values()).sort((a, b) => b.covered - a.covered);

                function exportCsv() {
                  const rows = [
                    ["Data", "Cliente", "Telefone", "Plano", "Serviço", "Coberto", "Extra"],
                    ...filtered.map((l: any) => [
                      l.used_at ? format(parseISO(l.used_at), "dd/MM/yyyy HH:mm") : "",
                      l.customer?.name || "",
                      l.customer?.phone || "",
                      l.plan?.name || "",
                      l.services?.name || l.benefit_type || "",
                      Number(l.covered_amount || 0).toFixed(2),
                      Number(l.extra_amount || 0).toFixed(2),
                    ]),
                  ];
                  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `uso-assinaturas-${format(new Date(), "yyyy-MM-dd")}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }

                return (
                  <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Atendimentos</p>
                        <p className="text-2xl font-black text-white mt-1">{filtered.length}</p>
                      </div>
                      <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Clientes únicos</p>
                        <p className="text-2xl font-black text-white mt-1">{uniqueCustomers}</p>
                      </div>
                      <div className="bg-[#0b0f17] border border-emerald-500/20 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Valor coberto</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">R$ {totalCovered.toFixed(2)}</p>
                      </div>
                      <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Receita extra</p>
                        <p className="text-2xl font-black text-white mt-1">R$ {totalExtra.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Filtros */}
                    <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {[
                            { id: "7", label: "7 dias" },
                            { id: "30", label: "30 dias" },
                            { id: "90", label: "90 dias" },
                            { id: "all", label: "Tudo" },
                            { id: "custom", label: "Datas..." },
                          ].map((opt) => (
                            <Button
                              key={opt.id}
                              size="sm"
                              variant={usageRange === opt.id ? "default" : "outline"}
                              onClick={() => setUsageRange(opt.id as any)}
                              className={cn(
                                "h-8 text-xs",
                                usageRange === opt.id
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-black border-none"
                                  : "bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-800/50"
                              )}
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                        <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-800/50">
                          Exportar CSV
                        </Button>
                      </div>

                      {usageRange === "custom" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] uppercase text-zinc-500">De</Label>
                            <Input type="date" value={usageFrom} onChange={(e) => setUsageFrom(e.target.value)} className="bg-[#05070d] border-zinc-800 text-white h-9" />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase text-zinc-500">Até</Label>
                            <Input type="date" value={usageTo} onChange={(e) => setUsageTo(e.target.value)} className="bg-[#05070d] border-zinc-800 text-white h-9" />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="relative">
                          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <Input
                            value={usageSearch}
                            onChange={(e) => setUsageSearch(e.target.value)}
                            placeholder="Buscar cliente, telefone ou serviço..."
                            className="pl-9 bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 h-9"
                          />
                        </div>
                        <Select value={usagePlanFilter} onValueChange={setUsagePlanFilter}>
                          <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-9">
                            <SelectValue placeholder="Plano" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os planos</SelectItem>
                            {plans.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={usageServiceFilter} onValueChange={setUsageServiceFilter}>
                          <SelectTrigger className="bg-[#05070d] border-zinc-800 text-white h-9">
                            <SelectValue placeholder="Serviço" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os serviços</SelectItem>
                            {servicesList.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Rankings */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5">
                        <h4 className="text-sm font-black mb-3 flex items-center gap-2"><Crown className="h-4 w-4 text-emerald-400" /> Planos por uso</h4>
                        {topPlans.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">Sem dados.</p>
                        ) : (
                          <ul className="space-y-2">
                            {topPlans.map((p, i) => (
                              <li key={i} className="flex items-center justify-between text-xs">
                                <span className="text-white font-bold truncate mr-2">{p.name}</span>
                                <span className="text-zinc-400 shrink-0">{p.count}x · <span className="text-emerald-400">R$ {p.covered.toFixed(2)}</span></span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5">
                        <h4 className="text-sm font-black mb-3 flex items-center gap-2"><Scissors className="h-4 w-4 text-emerald-400" /> Top serviços</h4>
                        {topServices.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">Sem dados.</p>
                        ) : (
                          <ul className="space-y-2">
                            {topServices.map((s, i) => (
                              <li key={i} className="flex items-center justify-between text-xs">
                                <span className="text-white font-bold truncate mr-2">{s.name}</span>
                                <span className="text-zinc-400 shrink-0">{s.count}x · <span className="text-emerald-400">R$ {s.covered.toFixed(2)}</span></span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5">
                        <h4 className="text-sm font-black mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-emerald-400" /> Top clientes</h4>
                        {topCustomers.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">Sem dados.</p>
                        ) : (
                          <ul className="space-y-2">
                            {topCustomers.map((c, i) => (
                              <li key={i} className="flex items-center justify-between text-xs">
                                <span className="text-white font-bold truncate mr-2">{c.name}</span>
                                <span className="text-zinc-400 shrink-0">{c.count}x · <span className="text-emerald-400">R$ {c.covered.toFixed(2)}</span></span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Tabela */}
                    <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                        <h4 className="text-sm font-black">Lançamentos ({filtered.length})</h4>
                      </div>
                      {filtered.length === 0 ? (
                        <p className="text-center py-12 text-zinc-500 italic text-sm">Nenhum uso encontrado para os filtros aplicados.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-[#05070d] text-zinc-500 uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="text-left px-4 py-3">Data</th>
                                <th className="text-left px-4 py-3">Cliente</th>
                                <th className="text-left px-4 py-3">Plano</th>
                                <th className="text-left px-4 py-3">Serviço</th>
                                <th className="text-right px-4 py-3">Coberto</th>
                                <th className="text-right px-4 py-3">Extra</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.slice(0, 200).map((l: any) => (
                                <tr key={l.id} className="border-t border-zinc-800/40 hover:bg-zinc-900/40">
                                  <td className="px-4 py-3 text-zinc-300">
                                    {l.used_at ? format(parseISO(l.used_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-white font-bold">{l.customer?.name || "—"}</p>
                                    <p className="text-zinc-500 text-[10px]">{l.customer?.phone || ""}</p>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-300">{l.plan?.name || "—"}</td>
                                  <td className="px-4 py-3 text-zinc-300">{l.services?.name || l.benefit_type || "—"}</td>
                                  <td className="px-4 py-3 text-right text-emerald-400 font-bold">R$ {Number(l.covered_amount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right text-zinc-300">R$ {Number(l.extra_amount || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {filtered.length > 200 && (
                            <p className="text-center py-3 text-[10px] text-zinc-500 uppercase">Mostrando 200 de {filtered.length} — refine os filtros para ver mais.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
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

              {/* FIDELIDADE & PREMIUM */}
              <Block title="Fidelidade & Premium">
                <div className="grid md:grid-cols-2 gap-2">
                  <ToggleRow
                    label="Participa da Fidelidade Tradicional"
                    checked={!!editingPlan.participates_traditional_loyalty}
                    onChange={(v) => setEditingPlan({ ...editingPlan, participates_traditional_loyalty: v })}
                  />
                  <ToggleRow
                    label="Participa do Cashback"
                    checked={!!editingPlan.participates_cashback}
                    onChange={(v) => setEditingPlan({ ...editingPlan, participates_cashback: v })}
                  />
                  <ToggleRow
                    label="Acumula Fidelidade Premium (por tempo)"
                    checked={!!editingPlan.accumulates_premium_loyalty}
                    onChange={(v) => setEditingPlan({ ...editingPlan, accumulates_premium_loyalty: v })}
                  />
                  <ToggleRow
                    label="Permite Desconto em Produtos"
                    checked={!!editingPlan.allows_product_discount}
                    onChange={(v) => setEditingPlan({ ...editingPlan, allows_product_discount: v })}
                  />
                  <ToggleRow
                    label="Prioridade na Agenda"
                    checked={!!editingPlan.agenda_priority}
                    onChange={(v) => setEditingPlan({ ...editingPlan, agenda_priority: v })}
                  />
                  <ToggleRow
                    label="Horários Exclusivos"
                    checked={!!editingPlan.exclusive_hours}
                    onChange={(v) => setEditingPlan({ ...editingPlan, exclusive_hours: v })}
                  />
                  <ToggleRow
                    label="Dias Exclusivos"
                    checked={!!editingPlan.exclusive_days}
                    onChange={(v) => setEditingPlan({ ...editingPlan, exclusive_days: v })}
                  />
                  <ToggleRow
                    label="Atendimento Preferencial"
                    checked={!!editingPlan.preferential_service}
                    onChange={(v) => setEditingPlan({ ...editingPlan, preferential_service: v })}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Clientes assinantes deste plano não acumularão cashback nem pontos de fidelidade tradicional se as opções acima estiverem desligadas — evitando dupla bonificação.
                </p>
              </Block>

              {/* SERVIÇOS COBERTOS PELO PLANO */}
              <Block title="Serviços cobertos por este plano">
                <p className="text-xs text-zinc-500 mb-3">
                  Marque os serviços que ficam <strong>inclusos</strong> na assinatura. No agendamento online, o cliente assinante não pagará por esses serviços (ou pagará apenas a diferença). Deixe o limite vazio para usos ilimitados dentro do limite total do plano.
                </p>
                {servicesList.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhum serviço cadastrado.</p>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
                    {servicesList.map((svc) => {
                      const entry = editingPlanServices[svc.id] || { included: false, max_uses_per_period: null };
                      return (
                        <div
                          key={svc.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 transition",
                            entry.included
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-zinc-700 bg-zinc-900/40"
                          )}
                        >
                          <Switch
                            checked={entry.included}
                            onCheckedChange={(v) =>
                              setEditingPlanServices((prev) => ({
                                ...prev,
                                [svc.id]: { ...entry, included: v },
                              }))
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{svc.name}</p>
                            <p className="text-xs text-zinc-400">{formatBRL(svc.price)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              placeholder="∞"
                              value={entry.max_uses_per_period ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                setEditingPlanServices((prev) => ({
                                  ...prev,
                                  [svc.id]: { ...entry, included: true, max_uses_per_period: isNaN(val as any) ? null : val },
                                }));
                              }}
                              disabled={!entry.included}
                              className={cn(inputCls, "w-20 text-center")}
                            />
                            <span className="text-[10px] text-zinc-500 uppercase">usos</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Block>



              {/* BENEFÍCIOS INCLUSOS */}
              <Block title="Benefícios Inclusos (lista visual)">
                <Field label="Um benefício por linha (ex: 4 cortes por mês)">
                  <Textarea
                    placeholder={"4 cortes por mês\nBarba inclusa\nHidratação mensal\nPrioridade na agenda"}
                    value={(editingPlan.included_benefits || []).join("\n")}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        included_benefits: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className={cn(inputCls, "min-h-[120px]")}
                  />
                </Field>
              </Block>

              {/* COMISSÃO DO BARBEIRO */}
              <Block title="Comissão do Barbeiro por Atendimento">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Tipo de comissão">
                    <Select
                      value={editingPlan.barber_commission_type || "fixed"}
                      onValueChange={(v) =>
                        setEditingPlan({
                          ...editingPlan,
                          barber_commission_type: v as any,
                        })
                      }
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Valor fixo por atendimento (R$)</SelectItem>
                        <SelectItem value="percent">Percentual do valor do plano (%)</SelectItem>
                        <SelectItem value="custom">Personalizada</SelectItem>
                        <SelectItem value="none">Sem comissão</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={editingPlan.barber_commission_type === "percent" ? "Percentual (%)" : "Valor (R$)"}>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editingPlan.barber_commission_value ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          barber_commission_value: parseFloat(e.target.value) || 0,
                        })
                      }
                      className={inputCls}
                      disabled={editingPlan.barber_commission_type === "none"}
                    />
                  </Field>
                </div>
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

      {/* PAUSE DIALOG */}
      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="h-5 w-5 text-blue-300" /> Pausar Assinatura
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pauseTarget && (
              <div className="text-sm text-zinc-400">
                <span className="text-white font-bold">{pauseTarget.customer?.name}</span> ·{" "}
                {pauseTarget.plan?.name}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Motivo da pausa</Label>
              <Input
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="Ex.: viagem, problemas financeiros..."
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Data prevista de retorno</Label>
              <Input
                type="date"
                value={pauseUntil}
                onChange={(e) => setPauseUntil(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Observações</Label>
              <Textarea
                value={pauseNotes}
                onChange={(e) => setPauseNotes(e.target.value)}
                placeholder="Observações internas (opcional)"
                className="bg-[#05070d] border-zinc-800 text-white min-h-[80px]"
              />
            </div>
            <div className="text-[11px] text-zinc-500 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              Durante a pausa, o cliente não consome benefícios, não acumula fidelidade premium,
              não recebe cobranças e não recebe lembretes de renovação.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPauseDialogOpen(false)} className="text-zinc-400">
              Cancelar
            </Button>
            <Button
              onClick={confirmPause}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold"
            >
              <Pause className="h-4 w-4 mr-2" /> Pausar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CHANGE PLAN DIALOG */}
      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-purple-300" /> Trocar Plano
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {changeTarget && (
              <div className="text-sm text-zinc-400">
                <span className="text-white font-bold">{changeTarget.customer?.name}</span> · plano atual:{" "}
                <span className="text-emerald-400 font-bold">{changeTarget.plan?.name}</span> ·{" "}
                {formatBRL(Number(changeTarget.plan?.monthly_price || 0))}/mês
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Novo plano</Label>
              <Select
                value={changeNewPlanId}
                onValueChange={(v) => {
                  setChangeNewPlanId(v);
                  loadChangePreview(v);
                }}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                  {plans
                    .filter((p) => p.active && p.id !== changeTarget?.plan_id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {formatBRL(Number(p.monthly_price))}/mês
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {changeLoading && (
              <div className="text-xs text-zinc-500">Calculando pró-rata...</div>
            )}

            {changePreview && (
              <div className="space-y-2 bg-[#05070d] border border-zinc-800 rounded-xl p-4">
                <Row label="Plano atual" value={`${formatBRL(Number(changePreview.old_price))} /mês`} />
                <Row label="Plano novo" value={`${formatBRL(Number(changePreview.new_price))} /mês`} />
                <Row label="Dias restantes" value={`${changePreview.days_remaining} de ${changePreview.days_in_cycle}`} />
                <Row label="Crédito proporcional (plano atual)" value={formatBRL(Number(changePreview.proration_credit))} />
                <Row label="Valor proporcional (plano novo)" value={formatBRL(Number(changePreview.proration_charge))} />
                <div className="border-t border-zinc-800 my-2" />
                {Number(changePreview.net_amount) > 0 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-amber-300 font-bold text-sm">Diferença a cobrar</span>
                    <span className="text-amber-400 font-black text-lg">
                      {formatBRL(Number(changePreview.net_amount))}
                    </span>
                  </div>
                ) : Number(changePreview.net_amount) < 0 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-300 font-bold text-sm">Crédito a gerar</span>
                    <span className="text-emerald-400 font-black text-lg">
                      {formatBRL(Math.abs(Number(changePreview.net_amount)))}
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-zinc-400 text-sm">Sem diferença a cobrar</div>
                )}
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 text-right mt-1">
                  Tipo: {changePreview.change_type === "upgrade" ? "Upgrade" : changePreview.change_type === "downgrade" ? "Downgrade" : "Mesmo valor"}
                </div>
              </div>
            )}

            {changePreview && Number(changePreview.net_amount) < 0 && (
              <div className="flex items-center justify-between bg-[#05070d] border border-zinc-800 rounded-xl px-4 py-3">
                <span className="text-sm font-bold">Aplicar crédito na carteira do cliente</span>
                <Switch
                  checked={changeApplyWallet}
                  onCheckedChange={setChangeApplyWallet}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Observações</Label>
              <Textarea
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="Motivo / observações internas (opcional)"
                className="bg-[#05070d] border-zinc-800 text-white min-h-[60px]"
              />
            </div>

            <div className="text-[11px] text-zinc-500 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
              O ciclo atual é mantido. Em upgrades, uma cobrança pendente é gerada pelo valor da diferença.
              Em downgrades, o crédito pode ser aplicado na carteira do cliente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeDialogOpen(false)} className="text-zinc-400">
              Cancelar
            </Button>
            <Button
              onClick={confirmChangePlan}
              disabled={!changePreview || !changeNewPlanId}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold disabled:opacity-50"
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Confirmar Troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HISTORY DIALOG */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-zinc-300" /> Histórico de Mudanças de Plano
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {(() => {
              const items = planChanges.filter((c) => !historyTarget || c.subscription_id === historyTarget.id);
              if (items.length === 0) {
                return (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    Nenhuma mudança de plano registrada.
                  </div>
                );
              }
              return items.map((c) => {
                const oldName = plans.find((p) => p.id === c.old_plan_id)?.name || "—";
                const newName = plans.find((p) => p.id === c.new_plan_id)?.name || "—";
                const net = Number(c.net_amount || 0);
                return (
                  <div
                    key={c.id}
                    className="bg-[#05070d] border border-zinc-800 rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-zinc-300">{oldName}</span>
                        <ArrowRightLeft className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="font-bold text-emerald-400">{newName}</span>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                          c.change_type === "upgrade"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : c.change_type === "downgrade"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                        )}
                      >
                        {c.change_type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <Row label="De" value={formatBRL(Number(c.old_price))} />
                      <Row label="Para" value={formatBRL(Number(c.new_price))} />
                      <Row label="Crédito" value={formatBRL(Number(c.proration_credit))} />
                      <Row label="Cobrança" value={formatBRL(Number(c.proration_charge))} />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
                      <span className="text-[11px] text-zinc-500">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                        {c.customer?.name ? ` · ${c.customer.name}` : ""}
                      </span>
                      <span
                        className={cn(
                          "font-black text-sm",
                          net > 0 ? "text-amber-400" : net < 0 ? "text-emerald-400" : "text-zinc-400"
                        )}
                      >
                        {net > 0 ? `+${formatBRL(net)}` : net < 0 ? `-${formatBRL(Math.abs(net))}` : formatBRL(0)}
                      </span>
                    </div>
                    {c.notes && (
                      <div className="text-[11px] text-zinc-500 italic">{c.notes}</div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
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
  accent: "emerald" | "sky" | "purple" | "amber" | "rose";
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
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "hover:border-rose-500/40",
      glow: "hover:shadow-[0_8px_28px_rgba(244,63,94,0.18)]",
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
