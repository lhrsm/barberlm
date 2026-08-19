import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { 
  Loader2, 
  Bell, 
  Settings, 
  LogOut,
  User as UserIcon,
  ArrowLeft,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { PortalNavigation } from "@/components/portal/premium/layout/PortalNavigation";
import { HomeTab } from "@/components/portal/premium/layout/HomeTab";
import { AppointmentsTab } from "@/components/portal/premium/tabs/AppointmentsTab";
import { FinancesTab } from "@/components/portal/premium/tabs/FinancesTab";
import { ProfileTab } from "@/components/portal/premium/tabs/ProfileTab";
import { LoyaltyLevelCard } from "@/components/loyalty/LoyaltyLevelCard";
import { AchievementGrid } from "@/components/loyalty/AchievementGrid";
import { Button } from "@/components/ui/button";
import { ClientLoginForm } from "@/components/public/auth/ClientLoginForm";

export const Route = createFileRoute("/$slug/portal")({
  component: CustomerPortalPage,
});

function CustomerPortalPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, profile, logout } = useAuth();
  const { slug } = useParams({ from: "/$slug/portal" });

  type PortalState = 'INITIALIZING' | 'AUTH_RESOLVED' | 'TENANT_RESOLVED' | 'CUSTOMER_RESOLVED' | 'DATA_READY' | 'ERROR' | 'NOT_FOUND';
  const [portalState, setPortalState] = useState<PortalState>('INITIALIZING');
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    customer: any;
    shop: any;
    appointments: any[];
    creditTransactions: any[];
    cashbackTransactions: any[];
    levels: any[];
    achievements: any[];
    unlockedAchievements: any[];
  } | null>(null);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  // ProfileTab state
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPortalData = useCallback(async () => {
    const trace = (event: string, meta?: any) => {
      console.log(`[PORTAL_RESOLUTION_TRACE] ${event}`, {
        timestamp: new Date().toISOString(),
        portalState,
        slug,
        userId: user?.id,
        ...meta
      });
    };

    trace("Starting loadPortalData");

    if (!user) {
      trace("No user, stopping");
      setPortalState('UNAUTHENTICATED' as any);
      setLoading(false);
      return;
    }

    setPortalState('AUTH_RESOLVED');

    // 1. Resolve Tenant
    let effectiveTenantId = profile?.tenant_id;
    if (!effectiveTenantId && slug) {
      trace("Resolving tenant from slug");
      const { data: shopData, error: shopErr } = await supabase
        .from("barbershops")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      
      if (shopData) {
        effectiveTenantId = shopData.id;
        trace("Tenant resolved", { effectiveTenantId });
      } else if (shopErr) {
        trace("Tenant resolution error", { shopErr });
      }
    }

    if (!effectiveTenantId) {
      trace("Tenant NOT resolved");
      setPortalState('ERROR');
      setErrorMessage("Estabelecimento não encontrado.");
      setLoading(false);
      return;
    }

    setPortalState('TENANT_RESOLVED');

    try {
      // 2. Resolve Customer
      trace("Fetching customer identity");
      
      // Strict lookup: tenant_id MUST match
      let { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*, loyalty_levels(*)")
        .eq("user_id", user.id)
        .eq("tenant_id", effectiveTenantId)
        .maybeSingle();

      if (customerError) throw customerError;
      
      // Fallback by phone (scoped to tenant)
      if (!customerData && profile?.phone) {
        trace("Customer not found by user_id, trying phone fallback");
        const normalized = profile.phone.replace(/\D/g, '');
        const { data: phoneMatch } = await supabase
          .from("customers")
          .select("*, loyalty_levels(*)")
          .eq("tenant_id", effectiveTenantId)
          .ilike("phone", `%${normalized}%`)
          .maybeSingle();
        
        if (phoneMatch) {
          trace("Phone match found", { customerId: phoneMatch.id });
          customerData = phoneMatch;
          
          // Link user_id if missing (Self-heal)
          if (!phoneMatch.user_id) {
            trace("Linking user_id to customer");
            await supabase
              .from("customers")
              .update({ user_id: user.id })
              .eq("id", phoneMatch.id);
          }
        }
      }

      if (!customerData) {
        trace("Customer NOT found");
        setPortalState('NOT_FOUND');
        setLoading(false);
        return;
      }

      setPortalState('CUSTOMER_RESOLVED');
      setCustomerName(customerData.name || "");

      // 3. Parallel Data Fetch
      trace("Fetching parallel data", { customerId: customerData.id });
      
      const [
        shopRes,
        apptsRes,
        creditsRes,
        cashbackRes,
        levelsRes,
        achRes,
        unlockedRes
      ] = await Promise.all([
        supabase.from("barbershops").select("*").eq("id", effectiveTenantId).maybeSingle(),
        supabase.from("appointments").select("*, services(*), barbers(*)").eq("customer_id", customerData.id).eq("tenant_id", effectiveTenantId).order("start_time", { ascending: false }),
        supabase.from("credit_transactions").select("*").eq("customer_id", customerData.id).order("created_at", { ascending: false }),
        supabase.from("cashback_transactions").select("*").eq("customer_id", customerData.id).order("created_at", { ascending: false }),
        supabase.from("loyalty_levels").select("*").order("sort_order", { ascending: true }),
        supabase.from("loyalty_achievements").select("*").order("xp_reward", { ascending: true }),
        supabase.from("customer_achievements").select("*").eq("customer_id", customerData.id)
      ]);

      trace("Data fetch complete", {
        apptsCount: apptsRes.data?.length,
        APPOINTMENT_VISIBILITY_TRACE: {
          customerId: customerData.id,
          tenantId: effectiveTenantId,
          appointments: apptsRes.data?.map(a => a.id)
        }
      });

      setData({
        customer: customerData,
        shop: shopRes.data,
        appointments: apptsRes.data || [],
        creditTransactions: (creditsRes as any).data || [],
        cashbackTransactions: (cashbackRes as any).data || [],
        levels: levelsRes.data || [],
        achievements: achRes.data || [],
        unlockedAchievements: unlockedRes.data || []
      });
      
      setPortalState('DATA_READY');
    } catch (err: any) {
      trace("Fatal error", { err });
      setPortalState('ERROR');
      setErrorMessage(err.message);
      toast.error("Erro ao sincronizar portal: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.tenant_id, profile?.phone, slug]);


  useEffect(() => {
    // Safety check for loading state
    if (loading && user && data?.customer) {
      setLoading(false);
    }
  }, [user, profile?.tenant_id, profile?.phone, slug]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheck;
      
      console.log("[PORTAL_VISIBILITY_TRACE]", {
        visibilityState: document.visibilityState,
        hasUser: !!user,
        hasProfile: !!profile,
        hasData: !!data,
        timeSinceLastCheck,
        timestamp: new Date().toISOString()
      });
      
      if (document.visibilityState === 'visible' && user && profile && timeSinceLastCheck > 5000) {
        console.log("[PORTAL_VISIBILITY_TRACE] Portal visible, refreshing data.");
        setLastCheck(now);
        loadPortalData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, profile, data, lastCheck, loadPortalData]);

  useEffect(() => {
    console.log("[PORTAL_BOOT_TRACE] Effect trigger", { 
      authLoading, 
      hasUser: !!user, 
      hasProfile: !!profile,
      identityStatus: profile?.identity_status
    });

    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      return;
    }

    // Regra Crítica: Se o usuário é ADMIN/STAFF mas caiu no portal do cliente,
    // devemos mantê-lo aqui se ele tiver um registro de cliente, ou redirecionar
    // se for estritamente administrativo. Mas por ora, permitimos o acesso se autenticado.
    
    if (profile) {
      loadPortalData();
    }
  }, [user, authLoading, profile, loadPortalData]);

  const handleLogout = async () => {
    try {
      await logout();
      // Use local redirect for consistency
      window.location.href = `/${slug}`;
    } catch (err) {
      console.error("Logout error:", err);
      navigate({ to: `/${slug}` as any, replace: true });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-gold animate-spin" />
          <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Autenticando...
          </p>
        </div>
      </div>
    );
  }

  if (user && loading) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-gold animate-spin" />
          <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Sincronizando sua Experiência...
          </p>
          {/* Fallback para evitar loading infinito */}
          <button 
            onClick={() => setLoading(false)} 
            className="mt-4 text-[9px] text-white/20 hover:text-white/40 uppercase tracking-widest font-bold"
          >
            Forçar Carregamento
          </button>
        </div>
      </div>
    );
  }

  // Dual-purpose Route: Login or Dashboard
  if (!user) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-[480px] space-y-8">
          <div className="flex justify-center mb-8">
            <a href={`/${slug}`}>
              <Button variant="ghost" className="text-gold hover:text-gold/80 hover:bg-gold/10 gap-2 font-black uppercase tracking-widest text-[10px]">
                <ArrowLeft size={16} /> Voltar para a barbearia
              </Button>
            </a>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <ClientLoginForm barbershopSlug={slug} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile || portalState === 'NOT_FOUND' || (portalState === 'DATA_READY' && !data?.customer)) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-700">
          <div className="h-20 w-20 rounded-3xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
            <UserIcon className="h-10 w-10 text-gold/40" />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
              {portalState === 'ERROR' ? "Erro de Conexão" : "Perfil não encontrado"}
            </h1>
            <p className="text-zinc-500 text-sm leading-relaxed">
              {portalState === 'ERROR' 
                ? (errorMessage || "Ocorreu um erro ao carregar seus dados. Por favor, tente novamente.")
                : "Não conseguimos localizar seu cadastro como cliente neste estabelecimento. Isso pode ocorrer se você for um administrador sem perfil de cliente associado."}
            </p>
          </div>
          
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              onClick={() => loadPortalData()} 
              variant="default" 
              className="bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-widest py-6 rounded-2xl"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Tentar Novamente"}
            </Button>
            
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              className="text-gold/60 hover:text-gold hover:bg-gold/10 font-bold uppercase tracking-widest text-[10px]"
            >
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
    );
  }


  const currentLevel = data.customer.loyalty_levels;
  const levels = data.levels || [];
  const currentIndex = levels.findIndex((l: any) => l.id === currentLevel?.id);
  const nextLevel = currentIndex !== -1 && currentIndex < levels.length - 1 ? levels[currentIndex + 1] : undefined;

  const achievements = data.achievements.map((ach: any) => ({
    ...ach,
    unlocked: data.unlockedAchievements?.some((ua: any) => ua.achievement_id === ach.id),
    unlocked_at: data.unlockedAchievements?.find((ua: any) => ua.achievement_id === ach.id)?.unlocked_at
  }));

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            client={data.customer}
            shop={data.shop}
            customerData={data.customer}
            mySubscription={null} // Will implement when subscription data is added
            appointments={data.appointments}
            sales={[]} // To be implemented if needed
            loyaltyRewards={[]} // To be implemented
            barbers={[]} // Needed for ProfissionalFavorito
            products={[]} // Needed for ProdutosRecomendados
            subscriptionsEnabled={false}
            onNewAppointment={() => window.dispatchEvent(new CustomEvent("OPEN_BOOKING_MODAL"))}
            onNavigate={setActiveTab}
          />
        );
      case "appointments":
        return (
          <AppointmentsTab 
            appointments={data.appointments}
            onViewDetails={(id) => console.log("View details", id)}
            onReview={(app) => console.log("Review", app)}
          />
        );
      case "finances":
        return (
          <FinancesTab 
            creditTransactions={data.creditTransactions}
            cashbackTransactions={data.cashbackTransactions}
          />
        );
      case "loyalty":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <LoyaltyLevelCard 
              currentXP={data.customer.xp || 0}
              currentLevel={currentLevel}
              nextLevel={nextLevel}
              achievementsCount={data.unlockedAchievements?.length || 0}
            />
            <div className="space-y-6">
              <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
                Minhas Conquistas
              </h2>
              <AchievementGrid achievements={achievements} />
            </div>
          </div>
        );
      case "profile":
        return (
          <ProfileTab 
            customerData={data.customer}
            setCustomerData={(newData) => setData({ ...data, customer: newData })}
            customerName={customerName}
            setCustomerName={setCustomerName}
            submitting={submitting}
            setSubmitting={setSubmitting}
            fetchClientData={() => loadPortalData()}
            slug={slug}
            setClient={() => {}} // Not used but kept for type compatibility
          />
        );
      case "security":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-4xl mx-auto">
              <Link to={`/${slug}/portal/security` as any}>
                <Button variant="outline" className="w-full h-20 border-gold/20 bg-gold/5 text-gold hover:bg-gold/10 flex items-center justify-between px-8 rounded-2xl group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gold/10 rounded-xl group-hover:scale-110 transition-transform">
                      <ShieldCheck size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-black uppercase tracking-widest italic text-lg">Central de Segurança</p>
                      <p className="text-gold/60 text-xs font-bold">MFA, Sessões Ativas e Proteção de Dados</p>
                    </div>
                  </div>
                  <ArrowLeft className="rotate-180 text-gold/40" />
                </Button>
              </Link>
            </div>
          </div>
        );
      default:
        return <div>Em breve...</div>;
    }
  };

  console.log("[PORTAL_BLACKSCREEN_TRACE] Rendering Portal Root", {
    hasUser: !!user,
    hasProfile: !!profile,
    hasData: !!data,
    loading,
    authLoading,
    activeTab,
    visibility: document.visibilityState
  });

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 w-full bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/30 flex items-center justify-center overflow-hidden">
              {data?.customer?.avatar_url ? (
                <img src={data.customer.avatar_url} alt={data.customer.name} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-6 w-6 text-gold" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/60">Bem-vindo à</p>
              <h2 className="text-lg font-black text-white leading-none">{data.shop?.business_name || 'Barbearia'}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-gold rounded-xl transition-all">
              <Bell className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-zinc-400 hover:text-gold rounded-xl transition-all"
              onClick={() => setActiveTab('profile')}
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-zinc-400 hover:text-red-400 rounded-xl transition-all"
              onClick={async () => {
                await logout();
                window.location.href = `/${slug}`;
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
            
            <a href={`/${slug}`} className="hidden md:block">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gold/30 text-gold hover:bg-gold/10 rounded-xl text-[10px] font-black uppercase tracking-widest h-9"
              >
                Site
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <PortalNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSubscriber={false}
        subscriptionsEnabled={false}
        storeEnabled={false}
        couponsEnabled={true}
        slug={slug}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
}
