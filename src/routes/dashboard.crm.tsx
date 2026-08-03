import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Search, 
  Sparkles, 
  TrendingUp, 
  Target, 
  UserCheck, 
  UserMinus, 
  Crown,
  Filter,
  ArrowRight
} from "lucide-react";
import { CustomerCrmDialog } from "@/components/customers/crm/CustomerCrmDialog";
import { computeKpis, formatBRL } from "@/components/customers/crm/metrics";
import { useCustomerCrm } from "@/components/customers/crm/useCustomerCrm";

export const Route = createFileRoute("/dashboard/crm")({
  component: CRM360Page,
});

function CRM360Page() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCrmOpen, setIsCrmOpen] = useState(false);
  
  // Data for the dialog
  const [history, setHistory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const { isEnabled: isModuleEnabled } = useModules();

  async function fetchData() {
    if (!user) return;
    const [custRes, subRes] = await Promise.all([
      supabase.from("customers").select("*").eq("tenant_id", user.id).order("name"),
      supabase.from("customer_subscriptions").select("*, subscription_plans(*)").eq("tenant_id", user.id).eq("status", "active")
    ]);

    setCustomers(custRes.data || []);
    setSubscriptions(subRes.data || []);
  }

  const subsByCustomer = useMemo(() => {
    const map = new Map();
    subscriptions.forEach(s => map.set(s.customer_id, s));
    return map;
  }, [subscriptions]);

  const customerData = useMemo(() => {
    return customers.map(c => {
      // Mock history/products/crm for summary KPIs if needed, 
      // but usually we'll calculate real ones when opening the profile
      const kpis = computeKpis(c, [], [], { cashback: [], creditTx: [], credits: [], reviews: [], automations: [], usage: [] });
      return { ...c, kpis };
    });
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customerData.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (c.phone && c.phone.includes(searchTerm));
      const matchesSegment = selectedSegment === "all" || c.kpis.segments.includes(selectedSegment) || c.kpis.funnelStage === selectedSegment;
      return matchesSearch && matchesSegment;
    });
  }, [customerData, searchTerm, selectedSegment]);

  const stats = useMemo(() => {
    return {
      total: customerData.length,
      vip: customerData.filter(c => c.kpis.funnelStage === "VIP").length,
      atRisk: customerData.filter(c => c.kpis.funnelStage === "Em Risco").length,
      inactive: customerData.filter(c => c.kpis.funnelStage === "Inativo").length,
      avgLtv: customerData.reduce((acc, c) => acc + c.kpis.totalSpent, 0) / (customerData.length || 1)
    };
  }, [customerData]);

  async function handleViewProfile(customer: any) {
    setSelectedCustomer(customer);
    setIsCrmOpen(true);
    setLoadingProfile(true);
    
    const [histRes, prodRes] = await Promise.all([
      supabase.from("appointments").select("*, services(name), barbers(name)").eq("customer_id", customer.id).order("start_time", { ascending: false }),
      supabase.from("product_sales").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false })
    ]);
    
    setHistory(histRes.data || []);
    setProducts(prodRes.data || []);
    setLoadingProfile(false);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Sparkles className="text-gold" /> CRM Inteligente 360°
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Análise profunda e inteligência de relacionamento com seus clientes.</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total de Clientes" value={stats.total} icon={Users} color="blue" />
          <StatCard title="Clientes VIP" value={stats.vip} icon={Crown} color="gold" />
          <StatCard title="Em Risco" value={stats.atRisk} icon={UserMinus} color="red" />
          <StatCard title="Ticket Médio LTV" value={formatBRL(stats.avgLtv)} icon={TrendingUp} color="emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <Card className="lg:col-span-1 bg-[#0b0f17] border-[#1f2937]">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Filter size={16} /> Segmentação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SegmentButton label="Todos Clientes" active={selectedSegment === "all"} onClick={() => setSelectedSegment("all")} count={stats.total} />
              <SegmentButton label="VIP" active={selectedSegment === "VIP"} onClick={() => setSelectedSegment("VIP")} count={stats.vip} color="text-gold" />
              <SegmentButton label="Em Risco" active={selectedSegment === "Em Risco"} onClick={() => setSelectedSegment("Em Risco")} count={stats.atRisk} color="text-red-400" />
              <SegmentButton label="Inativo" active={selectedSegment === "Inativo"} onClick={() => setSelectedSegment("Inativo")} count={stats.inactive} color="text-slate-500" />
              <SegmentButton label="Assinantes" active={selectedSegment === "Assinante"} onClick={() => setSelectedSegment("Assinante")} color="text-cyan-400" />
              <SegmentButton label="Compradores" active={selectedSegment === "Comprador da Loia"} onClick={() => setSelectedSegment("Comprador da Loia")} />
            </CardContent>
          </Card>

          {/* Customer List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
              <Input 
                placeholder="Buscar por nome ou telefone..." 
                className="pl-10 bg-[#0b0f17] border-[#1f2937] text-white h-12 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCustomers.map(customer => (
                  <CustomerListItem 
                    key={customer.id} 
                    customer={customer} 
                    subscription={subsByCustomer.get(customer.id)}
                    onClick={() => handleViewProfile(customer)} 
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {selectedCustomer && (
          <CustomerCrmDialog 
            isOpen={isCrmOpen}
            onOpenChange={setIsCrmOpen}
            customer={selectedCustomer}
            subscription={subsByCustomer.get(selectedCustomer.id)}
            history={history}
            products={products}
            loading={loadingProfile}
            onEdit={() => {}}
            onSaveNotes={() => fetchData()}
          />
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: "text-blue-400 bg-blue-400/10",
    gold: "text-gold bg-gold/10",
    red: "text-red-400 bg-red-400/10",
    emerald: "text-emerald-400 bg-emerald-400/10"
  };
  return (
    <Card className="bg-[#0b0f17] border-[#1f2937] overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</p>
            <p className="text-2xl font-black text-white mt-1">{value}</p>
          </div>
          <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", colors[color])}>
            <Icon size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SegmentButton({ label, active, onClick, count, color }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all",
        active ? "bg-gold text-black" : "text-slate-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <span className={cn(active ? "text-black" : color)}>{label}</span>
      {count !== undefined && <span className="opacity-60">{count}</span>}
    </button>
  );
}

function CustomerListItem({ customer, subscription, onClick }: any) {
  const isSub = !!subscription;
  const score = customer.kpis.relationshipScore;
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-5 rounded-2xl border bg-[#0b0f17] cursor-pointer transition-all hover:-translate-y-1 group",
        isSub ? "border-gold/30 hover:border-gold/60" : "border-[#1f2937] hover:border-slate-600"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center font-black border-2",
            isSub ? "border-gold bg-gold/10 text-gold" : "border-slate-700 bg-slate-800 text-slate-300"
          )}>
            {customer.name.substring(0, 2).toUpperCase()}
          </div>
          {isSub && <Crown className="absolute -top-1 -right-1 text-gold h-4 w-4 drop-shadow-lg" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-white truncate">{customer.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={cn("text-[10px] uppercase border-none px-0", score.color)}>
              Score: {score.label}
            </Badge>
            <span className="text-slate-600">•</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">
              {customer.kpis.funnelStage}
            </span>
          </div>
        </div>
        <ArrowRight className="text-slate-700 group-hover:text-gold transition-colors" size={18} />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
        <div>
          <p className="text-[9px] uppercase font-black text-slate-500">Gasto Total</p>
          <p className="text-sm font-black text-emerald-400">{formatBRL(customer.kpis.totalSpent)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase font-black text-slate-500">Última Visita</p>
          <p className="text-sm font-black text-white">
            {customer.kpis.daysSinceLast !== null ? `${customer.kpis.daysSinceLast}d atrás` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
