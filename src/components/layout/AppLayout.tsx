import { useState, useEffect, useId } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { 
  Calendar, 
  Users, 
  Scissors, 
  UserRound, 
  CircleDollarSign, 
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  CreditCard,
  Settings,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  Eye,
  StopCircle,
  LifeBuoy,
  HelpCircle,
  GraduationCap,
  Headset,
  Bell,
  MessageSquare,
  Megaphone,
  Share2
} from "lucide-react";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { NotificationsCenter } from "@/components/notifications/NotificationsCenter";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { TrialExpiredBlock } from "@/components/subscription/TrialExpiredBlock";
import { usePlanLimits } from "@/hooks/use-plan-limits";


import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/use-tenant";
import { useAuth } from "@/hooks/use-auth";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { toast } from "sonner";

const defaultNavItems = [
  { label: "Painel", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Agenda", icon: Calendar, to: "/calendar" },
  { label: "Clientes", icon: Users, to: "/customers" },
  { label: "Barbeiros", icon: UserRound, to: "/barbers" },
  { label: "Serviços", icon: Scissors, to: "/services" },
  { label: "Financeiro", icon: CircleDollarSign, to: "/finances" },
  { label: "Produtos", icon: ShoppingBag, to: "/products" },
  { label: "Automações", icon: MessageSquare, to: "/automations" },
  { label: "Campanhas", icon: Megaphone, to: "/campaigns" },
  { label: "Integrações", icon: Share2, to: "/integrations" },
  { label: "Tutoriais", icon: GraduationCap, to: "/tutorials" },
  { label: "Suporte", icon: Headset, to: "/support" },
  { label: "Assinatura", icon: CreditCard, to: "/subscription" },
  { label: "Configurações", icon: Settings, to: "/settings" },
];

const barberNavItems = (slug: string) => [
  { label: "Meu Painel", icon: LayoutDashboard, to: `/${slug}/profissional` },
  { label: "Minha Agenda", icon: Calendar, to: "/calendar" },
  { label: "Financeiro", icon: CircleDollarSign, to: "/finances" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const instanceId = useId().replace(/:/g, "");
  const { tenantProfile, isImpersonating, stopImpersonation, tenantId } = useTenant();
  const { role: authRole, user: authUser, loading: authLoading, profile: authProfile } = useAuth();
  const { session, loading: profLoading, logout: profLogout } = useProfessionalAuth();
  const navigate = useNavigate();
  const state = useRouterState();
  const pathname = state.location.pathname;

  const user = authUser || (session ? { id: session.barber_id } : null);
  const role = authRole || (session ? 'barber' : null);
  const loading = authLoading || profLoading;

  const slug = tenantProfile?.slug || authProfile?.slug || "general";

  const navItems = role === 'barber' ? [...barberNavItems(slug)] : [...defaultNavItems];
  
  if (role === 'super_admin' || role === 'admin') {
    navItems.push({ label: "Admin SaaS", icon: ShieldCheck, to: "/admin/dashboard" });
  }

  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== "/auth" && pathname !== "/" && !pathname.endsWith("/portal")) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    // Redirect super_admin to /admin if they are on a non-admin route and not impersonating
    if (user && role === 'super_admin' && !pathname.startsWith('/admin') && pathname !== '/auth' && !isImpersonating) {
      console.log("AppLayout: Redirecting super_admin to /admin/dashboard");
      navigate({ to: "/admin/dashboard" });
    }
  }, [pathname, navigate, role, user, loading, isImpersonating]);

  useEffect(() => {
    if (!user || role === 'super_admin') return;

    const channel = supabase
      .channel(`tenant-support-notifications-${instanceId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        table: 'ticket_messages',
        schema: 'public',
        filter: 'sender_type=eq.super_admin'

      }, () => {
        toast("Resposta do Suporte", {
          description: "Sua solicitação de suporte recebeu uma nova resposta.",
          icon: <LifeBuoy className="h-4 w-4 text-primary" />,
        });
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        table: 'support_tickets',
        schema: 'public'
      }, (payload) => {
        if (payload.new.barbershop_id === tenantId) {
          toast("Status do Ticket Atualizado", {
            description: `Seu chamado "${payload.new.title}" agora está ${payload.new.status}.`,
            icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, tenantId, instanceId]);

  const businessName = String(tenantProfile?.business_name || "Barbex");

  const handleLogout = async () => {
    if (session) {
      profLogout();
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const { isExpired, isTrial, subscription, loading: planLoading } = usePlanLimits();
  const isSubscriptionPage = pathname === "/subscription";
  
  // A rota só deve ser bloqueada se:
  // 1. Não houver assinatura ativa (isSubscribed é falso)
  // 2. E o trial expirou (isExpired é verdadeiro)
  // 3. E não for a página de assinatura
  const isSubscribed = ['active', 'trialing', 'past_due'].includes(subscription?.status?.toLowerCase() || '');
  
  // Se estiver inscrito, isExpired deve ser falso, mas garantimos aqui
  const shouldBlock = !isSubscribed && isExpired && !isSubscriptionPage && role !== 'super_admin' && !planLoading && !loading;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {shouldBlock && <TrialExpiredBlock />}
      <OnboardingModal />
      {isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-[60]">
          <div className="flex items-center gap-2">
            <Eye size={16} />
            <span>Modo Visualização: Você está acessando <strong>{businessName}</strong></span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 bg-white/20 hover:bg-white/30 border-none text-white"
            onClick={stopImpersonation}
          >
            <StopCircle size={14} className="mr-1.5" />
            Parar Visualização
          </Button>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-primary truncate max-w-[150px]">{businessName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsCenter />
          {role === 'super_admin' && <AdminNotifications />}
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </header>


      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background md:hidden overflow-auto">
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <h1 className="text-xl font-bold text-primary truncate">{businessName}</h1>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
              <X />
            </Button>
          </div>
          <nav className="p-4 flex flex-col h-full">
            <div className="space-y-2 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-xl text-base font-medium transition-all",
                    pathname === item.to
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <item.icon size={22} />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="pt-4 border-t border-white/10 mt-4">
              <LogoutButton />
            </div>
          </nav>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for desktop */}
        <aside className="hidden md:flex flex-col w-64 border-r bg-card shrink-0">
          <div className="p-6 flex items-center justify-between border-b border-white/5 mb-2">
            <h1 className="text-2xl font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              {businessName}
            </h1>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
                  pathname === item.to
                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon size={20} className={cn(pathname === item.to ? "animate-pulse" : "")} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t">
            <LogoutButton />
          </div>

        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header for Desktop */}
          <header className="hidden md:flex h-16 items-center justify-end px-8 border-b bg-card shrink-0">
            <div className="flex items-center gap-4">
              <NotificationsCenter />
              {role === 'super_admin' && <AdminNotifications />}
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}