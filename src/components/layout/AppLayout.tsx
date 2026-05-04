import { useState } from "react";
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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Painel", icon: LayoutDashboard, to: "/" },
  { label: "Agenda", icon: Calendar, to: "/calendar" },
  { label: "Clientes", icon: Users, to: "/customers" },
  { label: "Barbeiros", icon: UserRound, to: "/barbers" },
  { label: "Serviços", icon: Scissors, to: "/services" },
  { label: "Financeiro", icon: CircleDollarSign, to: "/finances" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const state = useRouterState();
  const pathname = state.location.pathname;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary">BarberSaaS</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
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

      {/* Mobile Top Header */}
      <div className="md:hidden flex flex-col w-full">
        <header className="flex items-center justify-between p-4 border-b bg-card">
          <h1 className="text-xl font-bold text-primary">BarberSaaS</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </header>

        {/* Mobile menu overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-background md:hidden pt-16">
            <nav className="p-6 space-y-2">
              {navItems.map((item) => (
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
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-4 px-4 py-4 text-lg text-destructive"
                onClick={handleLogout}
              >
                <LogOut size={24} />
                Sair
              </Button>
            </nav>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
