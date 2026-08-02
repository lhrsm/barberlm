import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ListChecks,
  Menu,
  X,
  LogOut,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useReception } from "@/hooks/use-reception";

const NAV = [
  { label: "Início", to: "/reception", icon: LayoutDashboard, exact: true },
  { label: "Agenda", to: "/reception/agenda", icon: CalendarDays },
  { label: "Lista de espera", to: "/reception/waiting-list", icon: ListChecks },
  { label: "Clientes", to: "/reception/customers", icon: Users },
];

export function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isOwner } = useReception();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Navegação da recepção">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isActive(item.to, item.exact)
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Central de Atendimento</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {open && (
        <div className="border-b border-border/60 bg-card px-4 py-3 lg:hidden">{nav}</div>
      )}

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card/60 p-4 lg:flex">
          <div className="mb-6 flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold leading-none">Recepção</p>
              <p className="text-xs text-muted-foreground">Central de Atendimento</p>
            </div>
          </div>
          {nav}
          <div className="mt-auto space-y-2">
            {isOwner && (
              <Link
                to="/dashboard"
                className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Voltar ao painel administrativo
              </Link>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" aria-hidden /> Sair
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 pb-24 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
