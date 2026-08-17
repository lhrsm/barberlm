import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useEffect, useMemo, useState, memo } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UserPlus,
  Search,
  Phone,
  Clock,
  User as UserIcon,
  Edit,
  Trash2,
  Crown,
  Sparkles,
  CalendarPlus,
  MessageCircle,
  Eye,
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
  AlertCircle,
  Award,
  Gem,
  Medal,
  Wallet,
} from "lucide-react";
import { format, differenceInDays, isAfter, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerCrmDialog } from "@/components/customers/crm/CustomerCrmDialog";

type Tier = "bronze" | "prata" | "ouro" | "diamante";

function getCustomerTier(c: any, isSubscriber: boolean): Tier {
  const spent = Number(c.total_spent || c.lifetime_value || 0);
  const visits = Number(c.total_visits || 0);
  if (isSubscriber && spent >= 800) return "diamante";
  if (spent >= 1500 || visits >= 30) return "diamante";
  if (spent >= 600 || visits >= 15) return "ouro";
  if (spent >= 200 || visits >= 5) return "prata";
  return "bronze";
}

const TIER_META: Record<Tier, { label: string; color: string; ring: string; icon: any }> = {
  bronze: { label: "Bronze", color: "text-amber-700", ring: "border-amber-800/40 bg-amber-900/10 hover:bg-amber-900/20 hover:border-amber-800/60", icon: Medal },
  prata: { label: "Prata", color: "text-slate-300", ring: "border-slate-500/40 bg-slate-500/10 hover:bg-slate-500/20 hover:border-slate-500/60", icon: Medal },
  ouro: { label: "Ouro", color: "text-gold", ring: "border-gold/40 bg-gold/10 hover:bg-gold/20 hover:border-gold/60", icon: Award },
  diamante: { label: "Diamante", color: "text-cyan-300", ring: "border-cyan-400/40 bg-cyan-400/10", icon: Gem },
};

function formatBRL(v: any) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function daysSinceLast(c: any): number | null {
  if (!c.last_visit) return null;
  return differenceInDays(new Date(), new Date(c.last_visit));
}

function isBirthdaySoon(c: any): boolean {
  if (!c.birth_date) return false;
  const bd = new Date(c.birth_date);
  const today = new Date();
  const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  const diff = differenceInDays(thisYear, today);
  return diff >= 0 && diff <= 15;
}

function openWhatsApp(phone: string | undefined) {
  if (!phone) return toast.error("Cliente sem telefone cadastrado");
  const clean = phone.replace(/\D/g, "");
  window.open(`https://wa.me/55${clean}`, "_blank");
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-300">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        required={required}
        className="bg-[#111827] border-[#1f2937] text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent, glow }: any) {
  return (
    <Card
      className={cn(
        "bg-[#0b0f17] border border-[#1f2937] shadow-none rounded-xl transition-all hover:border-gold/30",
        glow && "border-gold/30 shadow-[0_0_18px_-6px_rgba(212,175,55,0.35)]",
      )}
    >
      <CardHeader className="pb-1.5 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{label}</CardTitle>
        <Icon size={14} className="text-slate-500" />
      </CardHeader>
      <CardContent className="pb-3">
        <p className={cn("text-xl md:text-2xl font-black leading-tight", accent)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, accent = "text-white" }: any) {
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/5 px-2.5 py-2">
      <p className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">{label}</p>
      <p className={cn("text-sm font-black leading-tight mt-0.5", accent)}>{value}</p>
    </div>
  );
}

const CustomerCard = memo(({
  customer,
  subscription,
  onView,
  onEdit,
  onDelete,
}: {
  customer: any;
  subscription: any;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const isSub = !!subscription;
  const tier = getCustomerTier(customer, isSub);
  const tierMeta = TIER_META[tier];
  const TierIcon = tierMeta.icon;
  const days = daysSinceLast(customer);
  const birthdaySoon = isBirthdaySoon(customer);

  const insights: string[] = [];
  if (birthdaySoon) insights.push("🎂 Aniversário próximo");
  if (days !== null && days >= 45) insights.push(`⏱ ${days}d sem retornar`);
  if (Number(customer.cashback_balance) > 20) insights.push("💰 Cashback acumulado");
  if (isSub && subscription?.next_billing_at) {
    const dRenew = differenceInDays(new Date(subscription.next_billing_at), new Date());
    if (dRenew >= 0 && dRenew <= 7) insights.push(`🔄 Renova em ${dRenew}d`);
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 group",
        isSub
          ? "bg-gradient-to-br from-[#0b0f17] via-[#0f1420] to-[#1a1408] border-gold/50 shadow-[0_0_24px_-8px_rgba(212,175,55,0.4)] hover:shadow-[0_0_32px_-6px_rgba(212,175,55,0.55)]"
          : "bg-[#0b0f17] border-[#1f2937] hover:border-slate-600",
      )}
    >
      {isSub && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold via-[#F5C842] to-gold" />}
      {isSub && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-gradient-to-r from-gold to-[#F5C842] text-black px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow">
          <Crown size={10} /> Premium
        </div>
      )}
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            {customer.avatar_url ? (
              <img
                src={customer.avatar_url}
                alt={customer.name}
                className={cn(
                  "h-14 w-14 rounded-full object-cover border-2",
                  isSub ? "border-gold" : "border-slate-700",
                )}
              />
            ) : (
              <div
                className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center text-lg font-black border-2",
                  isSub
                    ? "border-gold bg-gradient-to-br from-gold/20 to-gold/5 text-gold"
                    : "border-slate-700 bg-slate-800 text-slate-300",
                )}
              >
                {initials(customer.name)}
              </div>
            )}
            {isSub && (
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gold flex items-center justify-center border-2 border-[#0b0f17]">
                <Crown size={12} className="text-black" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-white truncate pr-16">{customer.name}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Phone size={11} /> {customer.phone || "Sem telefone"}
            </p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {isSub ? (
                <Badge className="bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25 hover:border-gold/60 text-[9px] font-black uppercase tracking-wider transition-colors">
                  <Crown size={9} className="mr-1" /> Assinante
                </Badge>
              ) : (
                <Badge className="bg-slate-500/10 text-slate-300 border border-slate-500/30 hover:bg-slate-500/20 hover:border-slate-500/60 text-[9px] font-black uppercase tracking-wider transition-colors">
                  <UserIcon size={9} className="mr-1" /> Cliente
                </Badge>
              )}
              <Badge className={cn("text-[9px] font-black uppercase tracking-wider border", tierMeta.ring, tierMeta.color)}>
                <TierIcon size={9} className="mr-1" /> {tierMeta.label}
              </Badge>
            </div>
          </div>
        </div>
        {isSub && subscription?.subscription_plans && (
          <div className="rounded-lg bg-gold/5 border border-gold/20 px-3 py-2">
            <p className="text-[9px] uppercase text-gold/70 font-bold tracking-wider">Plano Atual</p>
            <p className="text-sm font-black text-white">{subscription.subscription_plans.name}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Atendimentos" value={customer.total_visits ?? 0} />
          <MiniStat label="Total gasto" value={formatBRL(customer.total_spent || customer.lifetime_value)} accent="text-emerald-400" />
          <MiniStat label="Cashback" value={formatBRL(customer.cashback_balance)} accent="text-gold" />
          <MiniStat label="Créditos" value={formatBRL(customer.credits)} accent="text-emerald-400" />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-3">
          <span className="flex items-center gap-1">
            <Clock size={10} /> Última: {customer.last_visit ? format(new Date(customer.last_visit), "dd/MM/yy") : "—"}
          </span>
          <span>
            Cliente desde {customer.created_at ? format(new Date(customer.created_at), "MM/yy") : "—"}
          </span>
        </div>
        {insights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {insights.map((i, idx) => (
              <span key={idx} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/10 text-slate-300">{i}</span>
            ))}
          </div>
        )}
        {!isSub && (
          <div className="rounded-lg bg-gold/5 border border-dashed border-gold/30 px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-300 leading-tight">Transforme em assinante e aumente a retenção.</p>
            <button onClick={() => openWhatsApp(customer.phone)} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gold text-black hover:brightness-110 shrink-0">Oferecer</button>
          </div>
        )}
        <div className="flex items-center gap-1.5 pt-1">
          <button title="WhatsApp" onClick={() => openWhatsApp(customer.phone)} className="flex-1 h-9 rounded-lg bg-green-600/10 border border-green-600/30 text-green-400 hover:bg-green-600/20 flex items-center justify-center transition-all"><MessageCircle size={14} /></button>
          <button title="Novo Agendamento" onClick={() => (window.location.href = `/calendar?customer=${customer.id}`)} className="flex-1 h-9 rounded-lg bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600/20 flex items-center justify-center transition-all"><CalendarPlus size={14} /></button>
          <button title="Ver Perfil" onClick={onView} className="flex-1 h-9 rounded-lg bg-gold/10 border border-gold/40 text-gold hover:bg-gold/20 flex items-center justify-center transition-all"><Eye size={14} /></button>
          <button title="Editar" onClick={onEdit} className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center justify-center transition-all"><Edit size={13} /></button>
          <button title="Excluir" onClick={onDelete} className="h-9 w-9 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20 flex items-center justify-center transition-all"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
});

const CustomersComponent = memo(() => {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [customerProducts, setCustomerProducts] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", notes: "", birth_date: "" });
  const [editingCustomer, setEditingCustomer] = useState({ id: "", name: "", phone: "", email: "", notes: "", birth_date: "" });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!loading && user && role === "super_admin") {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (user && role !== "super_admin") {
      fetchAll();
    }
  }, [user, role]);

  async function fetchAll() {
    await Promise.all([fetchCustomers(), fetchSubscriptions(), fetchShopProfile()]);
  }

  async function fetchShopProfile() {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) setShopProfile(data);
  }

  async function fetchCustomers() {
    if (!user) return;
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", user.id)
      .order("name");
    if (error) toast.error("Erro ao buscar clientes");
    else setCustomers(data || []);
  }

  async function fetchSubscriptions() {
    if (!user) return;
    const { data } = await supabase
      .from("customer_subscriptions")
      .select("*, subscription_plans(name, monthly_price, max_uses_per_month, benefits, usage_type)")
      .eq("tenant_id", user.id)
      .eq("status", "active");
    setSubscriptions(data || []);
  }

  const subsByCustomer = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of subscriptions) map.set(s.customer_id, s);
    return map;
  }, [subscriptions]);

  async function loadCustomerProfile(customer: any) {
    setSelectedCustomer(customer);
    setIsProfileOpen(true);
    setLoadingProfile(true);
    const [{ data: history }, { data: products }] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, services(name), barbers!appointments_barber_id_fkey(name), service_ratings(rating, comment)")
        .eq("customer_id", customer.id)
        .order("start_time", { ascending: false }),
      supabase
        .from("product_sales")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
    ]);
    setCustomerHistory(history || []);
    setCustomerProducts(products || []);
    setLoadingProfile(false);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("customers").insert({
      ...newCustomer,
      tenant_id: user.id,
      user_id: user.id,
    });
    if (error) toast.error("Erro ao adicionar cliente");
    else {
      toast.success("Cliente adicionado com sucesso!");
      setIsAddDialogOpen(false);
      setNewCustomer({ name: "", phone: "", email: "", notes: "", birth_date: "" });
      fetchCustomers();
    }
  }

  async function handleEditCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !editingCustomer.id) return;
    const { error } = await supabase
      .from("customers")
      .update({
        name: editingCustomer.name,
        phone: editingCustomer.phone,
        email: editingCustomer.email,
        notes: editingCustomer.notes,
        birth_date: editingCustomer.birth_date || null,
      })
      .eq("id", editingCustomer.id)
      .eq("tenant_id", user.id);
    if (error) toast.error("Erro ao atualizar cliente");
    else {
      toast.success("Cliente atualizado com sucesso!");
      setIsEditDialogOpen(false);
      fetchCustomers();
    }
  }

  async function handleDeleteCustomer() {
    if (!selectedCustomer || !user) return;
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", selectedCustomer.id)
      .eq("tenant_id", user.id);
    if (error) toast.error("Erro ao excluir cliente. Verifique se ele possui agendamentos vinculados.");
    else {
      toast.success("Cliente excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      fetchCustomers();
    }
  }

  async function handleSaveNotes(notes: string) {
    if (!user || !selectedCustomer) return;
    const { error } = await supabase
      .from("customers")
      .update({ notes })
      .eq("id", selectedCustomer.id)
      .eq("tenant_id", user.id);
    if (error) return toast.error("Erro ao salvar observações");
    toast.success("Observações salvas!");
    setSelectedCustomer({ ...selectedCustomer, notes });
    fetchCustomers();
  }

  const openEditDialog = (customer: any) => {
    setEditingCustomer({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
      birth_date: customer.birth_date || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

  const metrics = useMemo(() => {
    const total = customers.length;
    const subCount = subsByCustomer.size;
    const withCashback = customers.filter((c) => Number(c.cashback_balance) > 0).length;
    const withCredits = customers.filter((c) => Number(c.credits) > 0).length;
    const totalRevenue = customers.reduce((a, c) => a + Number(c.total_spent || c.lifetime_value || 0), 0);
    const avgTicket = total > 0 ? totalRevenue / total : 0;
    const inactive = customers.filter((c) => {
      const d = daysSinceLast(c);
      return d !== null && d > 60;
    }).length;
    const newMonth = customers.filter((c) => {
      if (!c.created_at) return false;
      return isAfter(new Date(c.created_at), subDays(new Date(), 30));
    }).length;
    const vip = customers.filter((c) => {
      const t = getCustomerTier(c, subsByCustomer.has(c.id));
      return t === "ouro" || t === "diamante";
    }).length;
    const birthdays = customers.filter(isBirthdaySoon).length;
    return { total, subCount, common: total - subCount, withCashback, withCredits, avgTicket, totalRevenue, inactive, newMonth, vip, birthdays };
  }, [customers, subsByCustomer]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return customers.filter((c) => {
      const sub = subsByCustomer.get(c.id);
      const matchSearch =
        !term ||
        c.name?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        sub?.subscription_plans?.name?.toLowerCase().includes(term) ||
        c.id?.toLowerCase().startsWith(term) ||
        String(c.id || "").slice(0, 8).toLowerCase().includes(term);
      if (!matchSearch) return false;

      const days = daysSinceLast(c);
      switch (filter) {
        case "subscribers": return !!sub;
        case "common": return !sub;
        case "cashback": return Number(c.cashback_balance) > 0;
        case "credits": return Number(c.credits) > 0;
        case "vip": {
          const t = getCustomerTier(c, !!sub);
          return t === "ouro" || t === "diamante";
        }
        case "inactive": return days !== null && days > 60;
        case "birthday": return isBirthdaySoon(c);
        case "d30": return days !== null && days >= 30 && days < 60;
        case "d60": return days !== null && days >= 60 && days < 90;
        case "recurring": return Number(c.total_visits || 0) >= 4 || (days !== null && days <= 45 && Number(c.total_visits || 0) >= 3);
        case "new": return !!c.created_at && isAfter(new Date(c.created_at), subDays(new Date(), 30));
        case "d90": return days !== null && days >= 90;
        default: return true;
      }
    });
  }, [customers, searchTerm, filter, subsByCustomer]);

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <Users className="text-gold" size={28} /> CRM de Clientes
            </h2>
            <p className="text-slate-400 text-sm mt-1">Gerencie seus clientes, assinantes e todo o histórico premium.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-gold to-[#F5C842] hover:brightness-110 text-black font-bold gap-2 shadow-lg shadow-[#D4AF37]/20 rounded-xl w-full md:w-auto">
                <UserPlus size={18} /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0b0f17] border-[#1f2937] text-white">
              <DialogHeader><DialogTitle className="text-white">Adicionar Novo Cliente</DialogTitle></DialogHeader>
              <form onSubmit={handleAddCustomer} className="space-y-4 pt-4">
                <FormField label="Nome Completo" required value={newCustomer.name} onChange={(v) => setNewCustomer({ ...newCustomer, name: v })} />
                <FormField label="Telefone / WhatsApp" placeholder="(00) 00000-0000" value={newCustomer.phone} onChange={(v) => setNewCustomer({ ...newCustomer, phone: v })} />
                <FormField label="Email (Opcional)" type="email" value={newCustomer.email} onChange={(v) => setNewCustomer({ ...newCustomer, email: v })} />
                <FormField label="Data de Nascimento" type="date" value={newCustomer.birth_date} onChange={(v) => setNewCustomer({ ...newCustomer, birth_date: v })} />
                <FormField label="Notas / Preferências" value={newCustomer.notes} onChange={(v) => setNewCustomer({ ...newCustomer, notes: v })} />
                <Button type="submit" className="w-full bg-gold text-black font-bold hover:bg-[#C5A028]">Salvar Cliente</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard icon={Users} label="Total de Clientes" value={metrics.total} accent="text-white" />
          <MetricCard icon={Crown} label="Assinantes Ativos" value={metrics.subCount} accent="text-gold" glow />
          <MetricCard icon={UserIcon} label="Clientes Comuns" value={metrics.common} accent="text-slate-200" />
          <MetricCard icon={Gem} label="Clientes VIP" value={metrics.vip} accent="text-cyan-300" />
          <MetricCard icon={Wallet} label="Com Cashback" value={metrics.withCashback} accent="text-gold" />
          <MetricCard icon={CreditCard} label="Com Créditos" value={metrics.withCredits} accent="text-emerald-400" />
          <MetricCard icon={TrendingUp} label="Ticket Médio" value={formatBRL(metrics.avgTicket)} accent="text-emerald-400" />
          <MetricCard icon={DollarSign} label="Faturamento" value={formatBRL(metrics.totalRevenue)} accent="text-gold" />
          <MetricCard icon={AlertCircle} label="Inativos (60+d)" value={metrics.inactive} accent="text-red-400" />
          <MetricCard icon={Sparkles} label="Novos no Mês" value={metrics.newMonth} accent="text-emerald-400" />
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <Input
              placeholder="Buscar por nome, telefone, e-mail, plano ou código..."
              className="pl-10 bg-[#0b0f17] border-[#1f2937] text-white focus:border-gold h-11 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { k: "all", label: "Todos" },
              { k: "subscribers", label: "👑 Assinantes" },
              { k: "common", label: "Clientes Comuns" },
              { k: "vip", label: "VIP" },
              { k: "cashback", label: "Com Cashback" },
              { k: "credits", label: "Com Créditos" },
              { k: "recurring", label: "Recorrentes" },
              { k: "new", label: "Novos (30d)" },
              { k: "birthday", label: "🎂 Aniversariantes" },
              { k: "inactive", label: "Inativos" },
              { k: "d30", label: "Sem visita 30d" },
              { k: "d60", label: "Sem visita 60d" },
              { k: "d90", label: "Sem visita 90d" },
            ].map((f) => (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all",
                  filter === f.k ? "bg-gold text-black border-gold shadow shadow-[#D4AF37]/30" : "bg-[#0b0f17] text-slate-300 border-[#1f2937] hover:border-gold/40",
                )}
              >{f.label}</button>
            ))}
          </div>
        </div>
        {filteredCustomers.length === 0 ? (
          <div className="bg-[#0b0f17] border border-[#1f2937] rounded-2xl p-16 text-center">
            <Users className="mx-auto text-slate-700 mb-3" size={48} />
            <p className="text-slate-400 font-semibold">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                subscription={subsByCustomer.get(customer.id)}
                onView={() => loadCustomerProfile(customer)}
                onEdit={() => openEditDialog(customer)}
                onDelete={() => openDeleteDialog(customer)}
              />
            ))}
          </div>
        )}
        <CustomerCrmDialog
          isOpen={isProfileOpen}
          onOpenChange={setIsProfileOpen}
          customer={selectedCustomer}
          subscription={selectedCustomer ? subsByCustomer.get(selectedCustomer.id) : null}
          shopProfile={shopProfile}
          history={customerHistory}
          products={customerProducts}
          loading={loadingProfile}
          onEdit={() => { if (selectedCustomer) openEditDialog(selectedCustomer); }}
          onSaveNotes={handleSaveNotes}
        />
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-[#0b0f17] border-[#1f2937] text-white">
            <DialogHeader><DialogTitle className="text-white">Editar Cliente</DialogTitle></DialogHeader>
            <form onSubmit={handleEditCustomer} className="space-y-4 pt-4">
              <FormField label="Nome Completo" required value={editingCustomer.name} onChange={(v) => setEditingCustomer({ ...editingCustomer, name: v })} />
              <FormField label="Telefone / WhatsApp" placeholder="(00) 00000-0000" value={editingCustomer.phone} onChange={(v) => setEditingCustomer({ ...editingCustomer, phone: v })} />
              <FormField label="Email (Opcional)" type="email" value={editingCustomer.email} onChange={(v) => setEditingCustomer({ ...editingCustomer, email: v })} />
              <FormField label="Data de Nascimento" type="date" value={editingCustomer.birth_date} onChange={(v) => setEditingCustomer({ ...editingCustomer, birth_date: v })} />
              <FormField label="Notas / Preferências" value={editingCustomer.notes} onChange={(v) => setEditingCustomer({ ...editingCustomer, notes: v })} />
              <Button type="submit" className="w-full bg-gold text-black font-bold hover:bg-[#C5A028]">Atualizar Cliente</Button>
            </form>
          </DialogContent>
        </Dialog>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="bg-[#0b0f17] border-[#1f2937] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Excluir Cliente</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Tem certeza que deseja excluir o cliente <span className="text-white font-bold">{selectedCustomer?.name}</span>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-[#1f2937] text-white hover:bg-[#111827]">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCustomer} className="bg-red-600 text-white hover:bg-red-700">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
});

export const Route = createFileRoute("/customers")({
  component: CustomersComponent,
});
