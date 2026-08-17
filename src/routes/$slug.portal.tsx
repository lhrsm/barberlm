import { createFileRoute, useNavigate, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoyaltyLevelCard } from "@/components/loyalty/LoyaltyLevelCard";
import { AchievementGrid } from "@/components/loyalty/AchievementGrid";
import { 
  Trophy, 
  Sparkles, 
  Crown, 
  ShieldCheck, 
  Activity,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/$slug/portal")({
  component: CustomerPortalGuard,
});

function CustomerPortalGuard() {
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Early exit if still loading initial auth state OR if we have a user but are still fetching their profile.
    // fetchProfileData in useAuth is async and might take a moment.
    if (loading || (user && !profile)) return;

    console.log("[PortalGuard] Identity Check:", { 
      hasUser: !!user, 
      hasProfile: !!profile, 
      identityStatus: profile?.identity_status,
      pathname: window.location.pathname
    });

    if (!user) {
      console.log("[PortalGuard] REDIRECT: No active session. Redirecting to login.");
      const currentPath = window.location.pathname;
      navigate({ 
        to: "/auth" as any, 
        search: { redirect: currentPath } as any
      });
      return;
    }

    // Now we have both user and profile
    if (profile?.identity_status === 'legacy') {
      console.log("[PortalGuard] REDIRECT: Legacy account detected. Redirecting to migration flow.");
      navigate({ to: "/auth" as any });
      return;
    }

    console.log("[PortalGuard] Access Granted.");
  }, [user, loading, profile, navigate]);

  // Concept: DISTINGUISH LOADING FROM UNAUTHENTICATED
  // Show loader while loading OR while we have a user but are still fetching their profile.
  // This prevents flickering or premature redirects.
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-gold animate-spin" />
          <p className="text-gold/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Validando Identidade Premium...
          </p>
        </div>
      </div>
    );
  }

  // If loading is done and we STILL don't have a user, the useEffect will handle the redirect.
  // We just need to make sure we don't render the page content if we're not ready.
  if (!user || !profile || profile.identity_status === 'legacy') {
    return null;
  }

  return <CustomerPortalPage />;
}

function CustomerPortalPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    customer: any;
    levels: any[];
    achievements: any[];
    unlockedAchievements: any[];
  } | null>(null);

  useEffect(() => {
    async function loadPortalData() {
      if (!user) return;
      try {
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("*, loyalty_levels(*)")
          .eq("user_id", user.id) 
          .eq("tenant_id", profile?.tenant_id)
          .maybeSingle();

        if (customerError) throw customerError;

        const [levelsRes, achRes, unlockedRes] = await Promise.all([
          supabase.from("loyalty_levels").select("*").order("sort_order", { ascending: true }),
          supabase.from("loyalty_achievements").select("*").order("xp_reward", { ascending: true }),
          customerData 
            ? supabase.from("customer_achievements").select("*").eq("customer_id", customerData.id)
            : Promise.resolve({ data: [] })
        ]);

        setData({
          customer: customerData,
          levels: levelsRes.data || [],
          achievements: achRes.data || [],
          unlockedAchievements: unlockedRes.data || []
        });
      } catch (err: any) {
        toast.error("Erro ao carregar portal: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="h-10 w-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  const currentLevel = data?.customer?.loyalty_levels;
  const levels = data?.levels || [];
  const currentIndex = levels.findIndex(l => l.id === currentLevel?.id);
  const nextLevel = currentIndex !== -1 && currentIndex < levels.length - 1 ? levels[currentIndex + 1] : undefined;

  const achievements = (data?.achievements || []).map(ach => ({
    ...ach,
    unlocked: data?.unlockedAchievements?.some(ua => ua.achievement_id === ach.id),
    unlocked_at: data?.unlockedAchievements?.find(ua => ua.achievement_id === ach.id)?.unlocked_at
  }));

  return (
    <div className="min-h-screen bg-[#05070d] text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">
              Meu Portal <span className="text-gold">Premium</span>
            </h1>
            <p className="text-zinc-400 font-medium">Bem-vindo de volta, {data?.customer?.name || 'Cliente'}.</p>
          </div>
          <Link 
            to="/$slug/portal/security"
            params={{ slug: (useParams({ from: '/$slug/portal' }) as any).slug }}
            className="md:hidden h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gold"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to="/$slug/portal/security"
            params={{ slug: (useParams({ from: '/$slug/portal' }) as any).slug }}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-gold hover:border-gold/20 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <ShieldCheck className="h-4 w-4" />
            Segurança
          </Link>

          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <Activity className="h-5 w-5 text-gold" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Saldo Atual</div>
            <div className="text-xl font-black text-white">R$ 45,90 <span className="text-gold/50 text-xs">em créditos</span></div>
          </div>
        </div>
      </div>
    </div>



      {/* Level Dashboard */}
      <LoyaltyLevelCard 
        currentXP={data?.customer?.xp || 0}
        currentLevel={currentLevel}
        nextLevel={nextLevel}
        achievementsCount={data?.unlockedAchievements?.length || 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Achievements Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
              <Trophy className="h-6 w-6 text-gold" />
              Minhas Conquistas
            </h2>
            <Button variant="link" className="text-gold text-xs font-black uppercase tracking-widest">
              Ver Todas <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <AchievementGrid achievements={achievements} />
        </div>

        {/* Perks & Rewards */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-gold" />
            Vantagens VIP
          </h2>
          <div className="space-y-3">
            {currentLevel?.benefits?.map((benefit: string, i: number) => (
              <div 
                key={i}
                className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-white/5 to-transparent border border-white/5 hover:border-gold/20 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="h-5 w-5 text-gold" />
                </div>
                <span className="text-sm font-bold text-zinc-300 leading-tight">{benefit}</span>
              </div>
            ))}
            {(!currentLevel?.benefits || currentLevel.benefits.length === 0) && (
              <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 italic text-sm">
                Nenhuma vantagem disponível para seu nível atual. Suba para o nível Prata para desbloquear!
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl bg-gold p-6 text-black relative overflow-hidden group">
            <div className="absolute top-0 right-0 opacity-10 -rotate-12 translate-x-4 -translate-y-4 group-hover:rotate-0 group-hover:translate-x-0 transition-transform duration-500">
              <Crown size={120} />
            </div>
            <div className="relative z-10">
              <h3 className="text-lg font-black uppercase italic tracking-tighter mb-2">Clube Barbex Pro</h3>
              <p className="text-sm font-bold mb-4 leading-tight opacity-80">Assine o plano mensal e ganhe XP em dobro em todos os serviços!</p>
              <Button className="w-full bg-black text-white font-black uppercase tracking-widest text-[10px] h-10 rounded-xl hover:bg-zinc-900">
                Saber Mais
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
