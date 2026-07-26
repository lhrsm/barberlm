import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
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
  Gift,
  Clock,
  User as UserIcon,
  Star,
  Edit,
  Trash2,
  Mail,
  Crown,
  Sparkles,
  CalendarPlus,
  MessageCircle,
  Eye,
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
  Cake,
  AlertCircle,
  Award,
  Gem,
  Medal,
  Package,
  History as HistoryIcon,
  Wallet,
} from "lucide-react";
import { format, differenceInDays, isAfter, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/customers")({
  component: CustomersComponent,
});

// ============================================================
// Helpers
// ============================================================

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
  ouro: { label: "Ouro", color: "text-[#D4AF37]", ring: "border-[#D4AF37]/40 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/60", icon: Award },
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

// ============================================================
// Component
// ============================================================

function CustomersComponent() {
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

  // Dashboard metrics
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
        sub?.subscription_plans?.name?.toLowerCase().includes(term);
      if (!matchSearch) return false;

      const days = daysSinceLast(c);
      switch (filter) {
        case "subscribers":
          return !!sub;
        case "common":
          return !sub;
        case "cashback":
          return Number(c.cashback_balance) > 0;
        case "credits":
          return Number(c.credits) > 0;
        case "vip": {
          const t = getCustomerTier(c, !!sub);
          return t === "ouro" || t === "diamante";
        }
        case "inactive":
          return days !== null && days > 60;
        case "birthday":
          return isBirthdaySoon(c);
        case "d30":
          return days !== null && days >= 30 && days < 60;
        case "d60":
          return days !== null && days >= 60 && days < 90;
        case "d90":
          return days !== null && days >= 90;
        default:
          return true;
      }
    });
  }, [customers, searchTerm, filter, subsByCustomer]);

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <Users className="text-[#D4AF37]" size={28} /> CRM de Clientes
            </h2>
            <p className="text-slate-400 text-sm mt-1">Gerencie seus clientes, assinantes e todo o histórico premium.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#D4AF37] to-[#F5C842] hover:brightness-110 text-black font-bold gap-2 shadow-lg shadow-[#D4AF37]/20 rounded-xl w-full md:w-auto">
                <UserPlus size={18} /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0b0f17] border-[#1f2937] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Adicionar Novo Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCustomer} className="space-y-4 pt-4">
                <FormField label="Nome Completo" required value={newCustomer.name} onChange={(v) => setNewCustomer({ ...newCustomer, name: v })} />
                <FormField label="Telefone / WhatsApp" placeholder="(00) 00000-0000" value={newCustomer.phone} onChange={(v) => setNewCustomer({ ...newCustomer, phone: v })} />
                <FormField label="Email (Opcional)" type="email" value={newCustomer.email} onChange={(v) => setNewCustomer({ ...newCustomer, email: v })} />
                <FormField label="Data de Nascimento" type="date" value={newCustomer.birth_date} onChange={(v) => setNewCustomer({ ...newCustomer, birth_date: v })} />
                <FormField label="Notas / Preferências" value={newCustomer.notes} onChange={(v) => setNewCustomer({ ...newCustomer, notes: v })} />
                <Button type="submit" className="w-full bg-[#D4AF37] text-black font-bold hover:bg-[#C5A028]">Salvar Cliente</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dashboard cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard icon={Users} label="Total de Clientes" value={metrics.total} accent="text-white" />
          <MetricCard icon={Crown} label="Assinantes Ativos" value={metrics.subCount} accent="text-[#D4AF37]" glow />
          <MetricCard icon={UserIcon} label="Clientes Comuns" value={metrics.common} accent="text-slate-200" />
          <MetricCard icon={Gem} label="Clientes VIP" value={metrics.vip} accent="text-cyan-300" />
          <MetricCard icon={Wallet} label="Com Cashback" value={metrics.withCashback} accent="text-[#D4AF37]" />
          <MetricCard icon={CreditCard} label="Com Créditos" value={metrics.withCredits} accent="text-emerald-400" />
          <MetricCard icon={TrendingUp} label="Ticket Médio" value={formatBRL(metrics.avgTicket)} accent="text-emerald-400" />
          <MetricCard icon={DollarSign} label="Faturamento" value={formatBRL(metrics.totalRevenue)} accent="text-[#D4AF37]" />
          <MetricCard icon={AlertCircle} label="Inativos (60+d)" value={metrics.inactive} accent="text-red-400" />
          <MetricCard icon={Sparkles} label="Novos no Mês" value={metrics.newMonth} accent="text-emerald-400" />
        </div>

        {/* Search + filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <Input
              placeholder="Buscar por nome, telefone, e-mail ou plano..."
              className="pl-10 bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#D4AF37] h-11 rounded-xl"
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
                  filter === f.k
                    ? "bg-[#D4AF37] text-black border-[#D4AF37] shadow shadow-[#D4AF37]/30"
                    : "bg-[#0b0f17] text-slate-300 border-[#1f2937] hover:border-[#D4AF37]/40",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer cards grid */}
        {filteredCustomers.length === 0 ? (
          <div className="bg-[#0b0f17] border border-[#1f2937] rounded-2xl p-16 text-center">
            <Users className="mx-auto text-slate-700 mb-3" size={48} />
            <p className="text-slate-400 font-semibold">Nenhum cliente encontrado</p>
            <p className="text-slate-600 text-sm mt-1">Ajuste sua busca ou adicione um novo cliente.</p>
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

        {/* Dialogs */}
        <CustomerProfileDialog
          isOpen={isProfileOpen}
          onOpenChange={setIsProfileOpen}
          customer={selectedCustomer}
          subscription={selectedCustomer ? subsByCustomer.get(selectedCustomer.id) : null}
          shopProfile={shopProfile}
          history={customerHistory}
          products={customerProducts}
          loading={loadingProfile}
          onEdit={() => {
            if (selectedCustomer) openEditDialog(selectedCustomer);
          }}
        />

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-[#0b0f17] border-[#1f2937] text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Editar Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditCustomer} className="space-y-4 pt-4">
              <FormField label="Nome Completo" required value={editingCustomer.name} onChange={(v) => setEditingCustomer({ ...editingCustomer, name: v })} />
              <FormField label="Telefone / WhatsApp" placeholder="(00) 00000-0000" value={editingCustomer.phone} onChange={(v) => setEditingCustomer({ ...editingCustomer, phone: v })} />
              <FormField label="Email (Opcional)" type="email" value={editingCustomer.email} onChange={(v) => setEditingCustomer({ ...editingCustomer, email: v })} />
              <FormField label="Data de Nascimento" type="date" value={editingCustomer.birth_date} onChange={(v) => setEditingCustomer({ ...editingCustomer, birth_date: v })} />
              <FormField label="Notas / Preferências" value={editingCustomer.notes} onChange={(v) => setEditingCustomer({ ...editingCustomer, notes: v })} />
              <Button type="submit" className="w-full bg-[#D4AF37] text-black font-bold hover:bg-[#C5A028]">Atualizar Cliente</Button>
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
              <AlertDialogAction onClick={handleDeleteCustomer} className="bg-red-600 text-white hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

// ============================================================
// UI Subcomponents
// ============================================================

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
        "bg-[#0b0f17] border border-[#1f2937] shadow-none rounded-xl transition-all hover:border-[#D4AF37]/30",
        glow && "border-[#D4AF37]/30 shadow-[0_0_18px_-6px_rgba(212,175,55,0.35)]",
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

function CustomerCard({
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
}) {
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
          ? "bg-gradient-to-br from-[#0b0f17] via-[#0f1420] to-[#1a1408] border-[#D4AF37]/50 shadow-[0_0_24px_-8px_rgba(212,175,55,0.4)] hover:shadow-[0_0_32px_-6px_rgba(212,175,55,0.55)]"
          : "bg-[#0b0f17] border-[#1f2937] hover:border-slate-600",
      )}
    >
      {/* Gold top bar for subscribers */}
      {isSub && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#F5C842] to-[#D4AF37]" />}

      {/* Premium seal */}
      {isSub && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-gradient-to-r from-[#D4AF37] to-[#F5C842] text-black px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow">
          <Crown size={10} /> Premium
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            {customer.avatar_url ? (
              <img
                src={customer.avatar_url}
                alt={customer.name}
                className={cn(
                  "h-14 w-14 rounded-full object-cover border-2",
                  isSub ? "border-[#D4AF37]" : "border-slate-700",
                )}
              />
            ) : (
              <div
                className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center text-lg font-black border-2",
                  isSub
                    ? "border-[#D4AF37] bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 text-[#D4AF37]"
                    : "border-slate-700 bg-slate-800 text-slate-300",
                )}
              >
                {initials(customer.name)}
              </div>
            )}
            {isSub && (
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#D4AF37] flex items-center justify-center border-2 border-[#0b0f17]">
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
                <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 text-[9px] font-black uppercase tracking-wider">
                  <Crown size={9} className="mr-1" /> Assinante
                </Badge>
              ) : (
                <Badge className="bg-slate-500/10 text-slate-300 border border-slate-500/30 text-[9px] font-black uppercase tracking-wider">
                  <UserIcon size={9} className="mr-1" /> Cliente
                </Badge>
              )}
              <Badge className={cn("text-[9px] font-black uppercase tracking-wider border", tierMeta.ring, tierMeta.color)}>
                <TierIcon size={9} className="mr-1" /> {tierMeta.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Plan info for subscribers */}
        {isSub && subscription?.subscription_plans && (
          <div className="rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/20 px-3 py-2">
            <p className="text-[9px] uppercase text-[#D4AF37]/70 font-bold tracking-wider">Plano Atual</p>
            <p className="text-sm font-black text-white">{subscription.subscription_plans.name}</p>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Atendimentos" value={customer.total_visits ?? 0} />
          <MiniStat label="Total gasto" value={formatBRL(customer.total_spent || customer.lifetime_value)} accent="text-emerald-400" />
          <MiniStat label="Cashback" value={formatBRL(customer.cashback_balance)} accent="text-[#D4AF37]" />
          <MiniStat label="Créditos" value={formatBRL(customer.credits)} accent="text-emerald-400" />
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-3">
          <span className="flex items-center gap-1">
            <Clock size={10} /> Última: {customer.last_visit ? format(new Date(customer.last_visit), "dd/MM/yy") : "—"}
          </span>
          <span>
            Cliente desde {customer.created_at ? format(new Date(customer.created_at), "MM/yy") : "—"}
          </span>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {insights.map((i, idx) => (
              <span
                key={idx}
                className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/10 text-slate-300"
              >
                {i}
              </span>
            ))}
          </div>
        )}

        {/* CTA to convert */}
        {!isSub && (
          <div className="rounded-lg bg-[#D4AF37]/5 border border-dashed border-[#D4AF37]/30 px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-300 leading-tight">Transforme em assinante e aumente a retenção.</p>
            <button
              onClick={() => openWhatsApp(customer.phone)}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#D4AF37] text-black hover:brightness-110 shrink-0"
            >
              Oferecer
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            title="WhatsApp"
            onClick={() => openWhatsApp(customer.phone)}
            className="flex-1 h-9 rounded-lg bg-green-600/10 border border-green-600/30 text-green-400 hover:bg-green-600/20 flex items-center justify-center transition-all"
          >
            <MessageCircle size={14} />
          </button>
          <button
            title="Novo Agendamento"
            onClick={() => (window.location.href = `/calendar?customer=${customer.id}`)}
            className="flex-1 h-9 rounded-lg bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600/20 flex items-center justify-center transition-all"
          >
            <CalendarPlus size={14} />
          </button>
          <button
            title="Ver Perfil"
            onClick={onView}
            className="flex-1 h-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 flex items-center justify-center transition-all"
          >
            <Eye size={14} />
          </button>
          <button
            title="Editar"
            onClick={onEdit}
            className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center justify-center transition-all"
          >
            <Edit size={13} />
          </button>
          <button
            title="Excluir"
            onClick={onDelete}
            className="h-9 w-9 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20 flex items-center justify-center transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
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

// ============================================================
// Profile Dialog
// ============================================================

function CustomerProfileDialog({
  isOpen,
  onOpenChange,
  customer,
  subscription,
  shopProfile,
  history,
  products,
  loading,
  onEdit,
}: any) {
  if (!customer) return null;
  const isSub = !!subscription;
  const tier = getCustomerTier(customer, isSub);
  const tierMeta = TIER_META[tier];

  const totalSpent = Number(customer.total_spent || customer.lifetime_value || 0);
  const visits = history.filter((h: any) => h.status === "completed").length || Number(customer.total_visits || 0);
  const avgTicket = visits > 0 ? totalSpent / visits : 0;
  const productsSpent = products.reduce((a: number, p: any) => a + Number(p.total_amount || 0), 0);

  const plan = subscription?.subscription_plans;
  const maxUses = plan?.max_uses_per_month ?? null;
  const usesThis = subscription?.uses_this_period ?? 0;
  const remaining = maxUses !== null ? Math.max(0, maxUses - usesThis) : null;
  const monthlySavings = isSub && plan?.monthly_price ? Math.max(0, totalSpent - Number(plan.monthly_price) * 3) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col bg-[#0b0f17] border-[#1f2937] text-white p-0 overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            "relative p-6 border-b border-[#1f2937]",
            isSub && "bg-gradient-to-br from-[#1a1408] via-[#0b0f17] to-[#0b0f17]",
          )}
        >
          {isSub && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#F5C842] to-[#D4AF37]" />}
          <DialogHeader>
            <DialogTitle className="sr-only">Perfil de {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col md:flex-row gap-5 items-start">
            <div className="relative">
              {customer.avatar_url ? (
                <img src={customer.avatar_url} alt={customer.name} className={cn("h-20 w-20 rounded-full object-cover border-2", isSub ? "border-[#D4AF37]" : "border-slate-700")} />
              ) : (
                <div className={cn("h-20 w-20 rounded-full flex items-center justify-center text-2xl font-black border-2", isSub ? "border-[#D4AF37] bg-gradient-to-br from-[#D4AF37]/25 to-[#D4AF37]/5 text-[#D4AF37]" : "border-slate-700 bg-slate-800 text-slate-300")}>
                  {initials(customer.name)}
                </div>
              )}
              {isSub && (
                <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#D4AF37] flex items-center justify-center border-2 border-[#0b0f17]">
                  <Crown size={14} className="text-black" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-black text-white">{customer.name}</h3>
                {isSub ? (
                  <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] font-black uppercase tracking-wider">
                    <Crown size={10} className="mr-1" /> Premium
                  </Badge>
                ) : (
                  <Badge className="bg-slate-500/10 text-slate-300 border border-slate-500/30 text-[10px] font-black uppercase tracking-wider">Cliente</Badge>
                )}
                <Badge className={cn("text-[10px] font-black uppercase border", tierMeta.ring, tierMeta.color)}>{tierMeta.label}</Badge>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone || "—"}</span>
                {customer.email && <span className="flex items-center gap-1"><Mail size={12} /> {customer.email}</span>}
                {customer.birth_date && <span className="flex items-center gap-1"><Cake size={12} /> {format(new Date(customer.birth_date), "dd/MM")}</span>}
                <span className="flex items-center gap-1"><Clock size={12} /> Última: {customer.last_visit ? format(new Date(customer.last_visit), "dd/MM/yyyy") : "—"}</span>
                <span>Cliente desde {customer.created_at ? format(new Date(customer.created_at), "MM/yyyy") : "—"}</span>
              </div>
              {isSub && plan && (
                <div className="mt-2 text-sm text-[#D4AF37] font-bold">Plano {plan.name}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => openWhatsApp(customer.phone)} className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
                <MessageCircle size={14} /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit} className="border-slate-700 text-slate-200 hover:bg-white/5 gap-1.5">
                <Edit size={14} /> Editar
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryStat label="Atendimentos" value={visits} accent="text-white" />
              <SummaryStat label="Valor gasto" value={formatBRL(totalSpent)} accent="text-emerald-400" />
              <SummaryStat label="Ticket médio" value={formatBRL(avgTicket)} accent="text-white" />
              <SummaryStat label="Produtos" value={formatBRL(productsSpent)} accent="text-white" />
              <SummaryStat label="Cashback" value={formatBRL(customer.cashback_balance)} accent="text-[#D4AF37]" />
              <SummaryStat label="Créditos" value={formatBRL(customer.credits)} accent="text-emerald-400" />
              <SummaryStat label="Fidelidade" value={`${customer.loyalty_points || 0}/${shopProfile?.free_service_threshold || 10}`} accent="text-white" />
              <SummaryStat label="Cashback usado" value={formatBRL(customer.cashback_used)} accent="text-slate-300" />
            </div>

            {/* Premium block */}
            {isSub ? (
              <div className="rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#D4AF37]/10 via-[#D4AF37]/[0.03] to-transparent p-5 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="text-[#D4AF37]" size={18} />
                  <h4 className="font-black text-white uppercase text-sm tracking-wider">Assinatura Premium</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <PremiumField label="Plano" value={plan?.name || "—"} />
                  <PremiumField label="Status" value="Ativa" accent="text-emerald-400" />
                  <PremiumField label="Adesão" value={subscription.started_at ? format(new Date(subscription.started_at), "dd/MM/yyyy") : "—"} />
                  <PremiumField label="Renovação" value={subscription.next_billing_at ? format(new Date(subscription.next_billing_at), "dd/MM/yyyy") : "—"} />
                  <PremiumField label="Mensalidade" value={formatBRL(plan?.monthly_price)} accent="text-[#D4AF37]" />
                  <PremiumField label="Consumidos" value={usesThis} />
                  <PremiumField label="Restantes" value={maxUses !== null ? remaining : "Ilimitado"} accent="text-[#D4AF37]" />
                  <PremiumField label="Economia" value={formatBRL(monthlySavings)} accent="text-emerald-400" />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D4AF37]/40 bg-[#D4AF37]/[0.03] p-5 text-center">
                <Crown className="mx-auto text-[#D4AF37] mb-2" size={26} />
                <p className="text-white font-bold">Este cliente ainda não faz parte do Clube Barbex.</p>
                <p className="text-slate-400 text-sm mt-1">Assinantes retornam mais e possuem maior fidelização.</p>
                <Button onClick={() => openWhatsApp(customer.phone)} className="mt-3 bg-gradient-to-r from-[#D4AF37] to-[#F5C842] text-black font-bold hover:brightness-110">
                  Oferecer Assinatura
                </Button>
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="appointments">
              <TabsList className="bg-[#111827] border border-[#1f2937] p-1 h-auto flex-wrap">
                <TabsTrigger value="appointments" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
                  <HistoryIcon size={13} className="mr-1.5" /> Agendamentos
                </TabsTrigger>
                <TabsTrigger value="financial" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
                  <DollarSign size={13} className="mr-1.5" /> Financeiro
                </TabsTrigger>
                <TabsTrigger value="products" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
                  <Package size={13} className="mr-1.5" /> Produtos
                </TabsTrigger>
                <TabsTrigger value="loyalty" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
                  <Gift size={13} className="mr-1.5" /> Fidelidade
                </TabsTrigger>
              </TabsList>

              <TabsContent value="appointments" className="mt-4">
                {loading ? (
                  <p className="text-slate-500 text-center py-8 animate-pulse">Carregando...</p>
                ) : history.length === 0 ? (
                  <EmptyState icon={HistoryIcon} text="Nenhum agendamento encontrado" />
                ) : (
                  <div className="space-y-2">
                    {history.map((app: any) => (
                      <div key={app.id} className="flex items-center justify-between p-3 bg-[#111827] border border-[#1f2937] rounded-xl hover:border-[#D4AF37]/30 transition-all">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white">{app.services?.name}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1"><Clock size={11} /> {format(new Date(app.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            <span className="flex items-center gap-1"><UserIcon size={11} /> {app.barbers?.name}</span>
                            {app.total_price != null && <span className="text-[#D4AF37] font-bold">{formatBRL(app.total_price)}</span>}
                            {app.payment_method && (
                              <Badge variant="outline" className="text-[9px] py-0 h-4 uppercase border-slate-700 text-slate-500 bg-[#0b0f17]">
                                {app.payment_method === "pix" ? "PIX" : app.payment_method === "credits" ? "Créditos" : app.payment_method === "cashback" ? "Cashback" : "Balcão"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge className={cn("text-[10px] uppercase font-bold border-none", app.status === "completed" ? "bg-green-500/10 text-green-500" : app.status === "scheduled" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500")}>
                            {app.status === "completed" ? "Concluído" : app.status === "scheduled" ? "Agendado" : "Cancelado"}
                          </Badge>
                          {app.service_ratings?.[0] && (
                            <div className="flex items-center gap-1 text-yellow-500">
                              <Star size={10} fill="currentColor" />
                              <span className="text-[10px] font-black">{app.service_ratings[0].rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="financial" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SummaryStat label="Total gasto" value={formatBRL(totalSpent)} accent="text-emerald-400" />
                  <SummaryStat label="Ticket médio" value={formatBRL(avgTicket)} accent="text-white" />
                  <SummaryStat label="Cashback recebido" value={formatBRL(Number(customer.cashback_balance) + Number(customer.cashback_used || 0))} accent="text-[#D4AF37]" />
                  <SummaryStat label="Cashback utilizado" value={formatBRL(customer.cashback_used)} accent="text-slate-300" />
                  <SummaryStat label="Créditos recebidos" value={formatBRL(Number(customer.credits) + Number(customer.credits_used || 0))} accent="text-emerald-400" />
                  <SummaryStat label="Créditos utilizados" value={formatBRL(customer.credits_used)} accent="text-slate-300" />
                </div>
              </TabsContent>

              <TabsContent value="products" className="mt-4">
                {products.length === 0 ? (
                  <EmptyState icon={Package} text="Nenhum produto adquirido" />
                ) : (
                  <div className="space-y-2">
                    {products.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                        <div>
                          <p className="font-bold text-white text-sm">{Array.isArray(p.items) ? `${p.items.length} item(s)` : "Compra"}</p>
                          <p className="text-[11px] text-slate-400">{format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        </div>
                        <p className="text-[#D4AF37] font-black">{formatBRL(p.total_amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="loyalty" className="mt-4 space-y-4">
                <div className="rounded-xl p-4 bg-[#111827] border border-[#1f2937]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Programa Tradicional</span>
                    <span className="text-[#D4AF37] font-black">
                      {customer.loyalty_points || 0} / {shopProfile?.free_service_threshold || 10}
                    </span>
                  </div>
                  <div className="h-2 bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#D4AF37] to-orange-500 transition-all"
                      style={{
                        width: `${Math.min(((customer.loyalty_points || 0) / (shopProfile?.free_service_threshold || 10)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Faltam {Math.max(0, (shopProfile?.free_service_threshold || 10) - (customer.loyalty_points || 0))} atendimentos para o próximo prêmio.
                  </p>
                </div>
                {isSub ? (
                  <div className="rounded-xl p-4 border border-[#D4AF37]/30 bg-[#D4AF37]/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Crown size={14} className="text-[#D4AF37]" />
                      <span className="text-white font-bold text-sm">Fidelidade Premium</span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      Assinante ativo do plano <span className="text-[#D4AF37] font-bold">{plan?.name}</span> — acumulando benefícios premium.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 border border-dashed border-slate-700 text-center text-slate-500 text-sm">
                    Cliente não participa da Fidelidade Premium.
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {customer.notes && (
              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 text-xs text-blue-200 italic">
                "{customer.notes}"
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value, accent = "text-white" }: any) {
  return (
    <div className="rounded-xl bg-[#111827] border border-[#1f2937] p-3">
      <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{label}</p>
      <p className={cn("text-lg font-black mt-1", accent)}>{value}</p>
    </div>
  );
}

function PremiumField({ label, value, accent = "text-white" }: any) {
  return (
    <div>
      <p className="text-[9px] uppercase text-[#D4AF37]/70 font-bold tracking-wider">{label}</p>
      <p className={cn("font-black mt-0.5", accent)}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: any) {
  return (
    <div className="text-center py-10">
      <Icon className="mx-auto text-slate-700 mb-2" size={36} />
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}
