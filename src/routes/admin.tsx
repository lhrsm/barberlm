import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, 
  Building2, 
  CreditCard, 
  BarChart3, 
  Activity, 
  AlertCircle, 
  LifeBuoy,
  ChevronLeft,
  LogOut,
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const adminNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard" },
  { label: "Barbearias", icon: Building2, to: "/admin/tenants" },
  { label: "Planos", icon: CreditCard, to: "/admin/plans" },
  { label: "Financeiro SaaS", icon: Activity, to: "/admin/finance" },
  { label: "Analytics", icon: BarChart3, to: "/admin/analytics" },
  { label: "Erros", icon: AlertCircle, to: "/admin/errors" },
  { label: "Suporte", icon: LifeBuoy, to: "/admin/support" },
];

function AdminLayout() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const state = useRouterState();
  const pathname = state.location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }

    if (role !== 'super_admin') {
      toast.error("Acesso negado. Apenas super administradores.");
      navigate({ to: "/dashboard" });
      return;
    }
  }, [user, loading, role, navigate]);

  const checking = loading || !role;

  if (loading || checking) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card">
        <div className="p-6 flex items-center gap-2">
          <div className="p-1.5 bg-primary rounded-lg">
            <ShieldCheck className="text-primary-foreground h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SaaS Admin</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {adminNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                pathname === item.to 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            <ChevronLeft size={18} />
            Voltar ao App
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut size={18} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden flex flex-col w-full">
        <header className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary h-6 w-6" />
            <h1 className="font-bold">SaaS Admin</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </header>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-background md:hidden pt-16">
            <nav className="p-6 space-y-2">
              {adminNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium",
                    pathname === item.to 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <item.icon size={24} />
                  {item.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-4 px-4 py-4 text-lg mb-2"
                  onClick={() => navigate({ to: "/dashboard" })}
                >
                  <ChevronLeft size={24} />
                  Voltar ao App
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-4 px-4 py-4 text-lg text-destructive"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/auth" });
                  }}
                >
                  <LogOut size={24} />
                  Sair
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
