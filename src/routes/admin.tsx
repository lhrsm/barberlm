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
  Layout,
  Menu,
  MessageCircle,
  X,
  History,
  Settings,
  ArrowUpRight,
  TrendingUp,
  LineChart as LineChartIcon,
  Download,
  GraduationCap
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
  { label: "Assinaturas", icon: CreditCard, to: "/admin/subscriptions" },
  { label: "Planos", icon: Layout, to: "/admin/plans" },
  { label: "Receita", icon: TrendingUp, to: "/admin/finance" },
  { label: "Relatórios", icon: BarChart3, to: "/admin/reports" },
  { label: "Analytics", icon: LineChartIcon, to: "/admin/analytics" },
  { label: "Logs do Sistema", icon: History, to: "/admin/errors" },
  { label: "Suporte", icon: LifeBuoy, to: "/admin/support" },
  { label: "Tutoriais", icon: GraduationCap, to: "/admin/tutorials" },
  { label: "Configurações", icon: Settings, to: "/admin/settings" },
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

  useEffect(() => {
    if (!user || role !== 'super_admin') return;

    const channel = supabase
      .channel('admin-support-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        table: 'support_tickets',
        schema: 'public'
      }, (payload) => {
        toast("Novo Ticket Aberto", {
          description: payload.new.title,
          icon: <LifeBuoy className="h-4 w-4 text-purple-500" />,
        });
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        table: 'support_messages',
        schema: 'public',
        filter: 'is_admin_reply=eq.false'
      }, () => {
        toast("Nova Resposta no Suporte", {
          description: "Um cliente respondeu a um chamado.",
          icon: <MessageCircle className="h-4 w-4 text-purple-500" />,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

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
            <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Barbex Admin</span>
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
              <h1 className="font-bold text-white uppercase tracking-tighter">Barbex Admin</h1>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-black/20 shrink-0 backdrop-blur-xl">
          <nav className="flex-1 px-4 py-6 flex flex-col gap-1">
            <div className="flex-1 space-y-1">
              {adminNavItems.slice(0, -1).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group",
                    pathname === item.to
                      ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon size={18} className={cn("transition-colors", pathname === item.to ? "text-purple-400" : "group-hover:text-pink-400")} />
                  {item.label}
                </Link>
              ))}
            </div>
            
            <div className="pt-4 border-t border-white/5">
              {adminNavItems.slice(-1).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group",
                    pathname === item.to
                      ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon size={18} className={cn("transition-colors", pathname === item.to ? "text-purple-400" : "group-hover:text-pink-400")} />
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}