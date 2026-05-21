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
  X,
  History,
  Settings,
  ArrowUpRight,
  TrendingUp,
  LineChart as LineChartIcon,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const adminNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard" },
  { label: "Barbearias", icon: Building2, to: "/admin/tenants" },
  { label: "Planos", icon: CreditCard, to: "/admin/plans" },
  { label: "Receita", icon: TrendingUp, to: "/admin/finance" },
  { label: "Analytics", icon: BarChart3, to: "/admin/analytics" },
  { label: "Logs do Sistema", icon: History, to: "/admin/errors" },
  { label: "Configurações", icon: Settings, to: "/admin/settings" },
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
      console.log("Admin route guard: No session found, redirecting to /auth");
      navigate({ to: "/auth", replace: true });
      return;
    }

    if (role === undefined) {
      console.log("Admin route guard: Session exists but role is still loading");
      return;
    }

    if (role !== 'super_admin') {
      console.warn("Admin route guard: Access denied. Role:", role);
      toast.error("Acesso negado. Apenas super administradores.");
      navigate({ to: "/dashboard" });
      return;
    }
    
    console.log("Admin route guard: Access granted for super_admin");
  }, [user, loading, role, navigate]);

  const checking = loading || !role;

  if (loading || checking) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (role !== 'super_admin') return null;

  return (
    <div className="flex flex-col h-screen bg-black text-white selection:bg-purple-500/30">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 glass bg-black/40 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden text-gray-400" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-purple-500 h-6 w-6" />
            <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">SaaS Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50 hover:bg-purple-500/30 transition-colors">SUPER ADMIN</Badge>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
        </div>
      </header>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 md:hidden overflow-auto backdrop-blur-xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-purple-500 h-6 w-6" />
              <h1 className="font-bold text-white uppercase tracking-tighter">SaaS Admin</h1>
            </div>
            <Button variant="ghost" size="icon" className="text-gray-400" onClick={() => setIsMobileMenuOpen(false)}>
              <X />
            </Button>
          </div>
          <nav className="p-6 space-y-3">
            {adminNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-6 py-4 rounded-2xl text-lg font-bold transition-all",
                  pathname === item.to
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={22} />
                {item.label}
              </Link>
            ))}
            <div className="pt-8 mt-8 border-t border-white/10 space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-4 px-6 py-6 text-lg rounded-2xl border-white/10 bg-white/5 text-white"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate({ to: "/dashboard" });
                }}
              >
                <ChevronLeft size={22} />
                Voltar ao App
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-4 px-6 py-6 text-lg rounded-2xl text-rose-500 hover:bg-rose-500/10"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
              >
                <LogOut size={22} />
                Sair do Sistema
              </Button>
            </div>
          </nav>
        </div>
      )}
  );
}
