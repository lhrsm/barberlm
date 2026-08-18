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

  // ProfileTab state
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPortalData = useCallback(async () => {
    if (!user || !profile?.tenant_id) return;
    
    try {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*, loyalty_levels(*)")
        .eq("user_id", user.id) 
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customerData) {
        setLoading(false);
        return;
      }

      setCustomerName(customerData.name || "");

      const [
        shopRes,
        apptsRes,
        creditsRes,
        cashbackRes,
        levelsRes,
        achRes,
        unlockedRes
      ] = await Promise.all([
        supabase.from("barbershops").select("*").eq("id", profile.tenant_id).maybeSingle(),
        supabase.from("appointments").select("*, services(*), barbers(*)").eq("customer_id", customerData.id).order("start_time", { ascending: false }),
        supabase.from("credit_transactions").select("*").eq("customer_id", customerData.id).order("created_at", { ascending: false }),
        supabase.from("cashback_transactions").select("*").eq("customer_id", customerData.id).order("created_at", { ascending: false }),
        supabase.from("loyalty_levels").select("*").order("sort_order", { ascending: true }),
        supabase.from("loyalty_achievements").select("*").order("xp_reward", { ascending: true }),
        supabase.from("customer_achievements").select("*").eq("customer_id", customerData.id)
      ]);

      setData({
        customer: customerData,
        shop: shopRes.data,
        appointments: apptsRes.data || [],
        creditTransactions: creditsRes.data || [],
        cashbackTransactions: cashbackRes.data || [],
        levels: levelsRes.data || [],
        achievements: achRes.data || [],
        unlockedAchievements: unlockedRes.data || []
      });
    } catch (err: any) {
      console.error("Portal Load Error:", err);
      toast.error("Erro ao carregar portal: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.tenant_id]);

  useEffect(() => {
    if (authLoading) return;
    
    // Se não há usuário, não redirecionamos, o componente renderizará o formulário de login
    if (!user) {
      setLoading(false);
      return;
    }

    if (profile?.identity_status === 'legacy') {
      // Clientes legado que conseguiram logar de alguma forma devem ser tratados
      // Mas a arquitetura atual bloqueia isso no ClientLoginForm
      navigate({ to: `/${slug}` as any, replace: true });
      return;
    }

    if (profile) {
      loadPortalData();
    }
  }, [user, authLoading, profile, navigate, loadPortalData, slug]);

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

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-gold animate-spin" />
          <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Sincronizando sua Experiência...
          </p>
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
            <Link to={`/${slug}` as any}>
              <Button variant="ghost" className="text-gold hover:text-gold/80 hover:bg-gold/10 gap-2 font-black uppercase tracking-widest text-[10px]">
                <ArrowLeft size={16} /> Voltar para a barbearia
              </Button>
            </Link>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <ClientLoginForm barbershopSlug={slug} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !data?.customer) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-gold font-black uppercase tracking-widest italic">Perfil não encontrado</p>
          <Button onClick={handleLogout} variant="outline" className="border-gold text-gold hover:bg-gold/10">
            Sair e tentar novamente
          </Button>
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

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 w-full bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/30 flex items-center justify-center overflow-hidden">
              {data.customer.avatar_url ? (
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
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
            
            <Link to={`/${slug}` as any} className="hidden md:block">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gold/30 text-gold hover:bg-gold/10 rounded-xl text-[10px] font-black uppercase tracking-widest h-9"
              >
                Site
              </Button>
            </Link>
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
