import { useState, useEffect } from "react";
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
  Eye,
  StopCircle,
  LifeBuoy,
  HelpCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/use-tenant";
import { useAuth } from "@/hooks/use-auth";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";

const defaultNavItems = [
  { label: "Painel", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Agenda", icon: Calendar, to: "/calendar" },
  { label: "Clientes", icon: Users, to: "/customers" },
  { label: "Barbeiros", icon: UserRound, to: "/barbers" },
  { label: "Serviços", icon: Scissors, to: "/services" },
  { label: "Financeiro", icon: CircleDollarSign, to: "/finances" },
  { label: "Produtos", icon: ShoppingBag, to: "/products" },
  { label: "Assinatura", icon: CreditCard, to: "/subscription" },
  { label: "Suporte", icon: LifeBuoy, to: "/support" },
  { label: "Tutoriais", icon: HelpCircle, to: "/support" },
  { label: "Configurações", icon: Settings, to: "/settings" },
];

const barberNavItems = [
  { label: "Agenda", icon: Calendar, to: "/calendar" },
  { label: "Histórico Financeiro", icon: CircleDollarSign, to: "/finances" },
  { label: "Suporte", icon: LifeBuoy, to: "/support" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { tenantProfile, isImpersonating, stopImpersonation, tenantId } = useTenant();
  const { role: authRole, user: authUser, loading: authLoading } = useAuth();
  const { session, loading: profLoading, logout: profLogout } = useProfessionalAuth();
  const navigate = useNavigate();
  const state = useRouterState();
  const pathname = state.location.pathname;

  const user = authUser || (session ? { id: session.barber_id } : null);
  const role = authRole || (session ? 'barber' : null);
  const loading = authLoading || profLoading;

  const navItems = role === 'barber' ? [...barberNavItems] : [...defaultNavItems];
  
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

  const businessName = String(tenantProfile?.business_name || "BarberSaaS");

  const handleLogout = async () => {
    if (session) {
      profLogout();
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
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
        <h1 className="text-xl font-bold text-primary truncate">{businessName}</h1>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </Button>
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
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl text-base font-medium",
                  pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon size={22} />
                {item.label}
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start gap-4 px-4 py-3 text-base text-destructive"
              onClick={handleLogout}
            >
              <LogOut size={22} />
              Sair
            </Button>
          </nav>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for desktop */}
        <aside className="hidden md:flex flex-col w-64 border-r bg-card shrink-0">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-primary truncate">{businessName}</h1>
          </div>
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut size={20} />
              Sair
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}