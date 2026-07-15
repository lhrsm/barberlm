import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  BarChart3,
  Activity,
  LifeBuoy,
  Layout,
  TrendingUp,
  LineChart,
  History,
  Bell,
  Settings,
  GraduationCap,
  ShieldCheck,
  Search,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard", group: "Navegação" },
  { label: "Barbearias", icon: Building2, to: "/admin/tenants", group: "Navegação" },
  { label: "Assinaturas", icon: CreditCard, to: "/admin/subscriptions", group: "Navegação" },
  { label: "Planos", icon: Layout, to: "/admin/plans", group: "Navegação" },
  { label: "Receita", icon: TrendingUp, to: "/admin/finance", group: "Navegação" },
  { label: "Relatórios", icon: BarChart3, to: "/admin/reports", group: "Navegação" },
  { label: "Analytics", icon: LineChart, to: "/admin/analytics", group: "Navegação" },
  { label: "Logs do Sistema", icon: History, to: "/admin/errors", group: "Navegação" },
  { label: "Notificações", icon: Bell, to: "/admin/notifications", group: "Navegação" },
  { label: "Status", icon: Activity, to: "/admin/status", group: "Navegação" },
  { label: "Suporte", icon: LifeBuoy, to: "/admin/support", group: "Navegação" },
  { label: "LGPD", icon: ShieldCheck, to: "/admin/lgpd", group: "Navegação" },
  { label: "Tutoriais", icon: GraduationCap, to: "/admin/tutorials", group: "Navegação" },
  { label: "Configurações", icon: Settings, to: "/admin/settings", group: "Navegação" },
];

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: tenants } = useQuery({
    queryKey: ["cmdk-tenants", search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, business_name, slug, plan")
        .ilike("business_name", `%${search}%`)
        .limit(6);
      return data || [];
    },
    enabled: open && search.length >= 2,
    staleTime: 30_000,
  });

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar barbearia, ir para… (⌘K)"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>Nenhum resultado.</CommandEmpty>

          {tenants && tenants.length > 0 && (
            <>
              <CommandGroup heading="Barbearias">
                {tenants.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`tenant-${t.id}-${t.business_name}`}
                    onSelect={() =>
                      run(() => {
                        sessionStorage.setItem("impersonated_tenant_id", t.id);
                        toast.success(`Impersonando ${t.business_name}`);
                        navigate({ to: "/dashboard" });
                      })
                    }
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="flex-1">{t.business_name || "Sem nome"}</span>
                    {t.plan && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t.plan}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navegação rápida">
            {navItems.map((item) => (
              <CommandItem
                key={item.to}
                value={`nav-${item.label}`}
                onSelect={() => run(() => navigate({ to: item.to }))}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                <ArrowRight className="h-3 w-3 opacity-40" />
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ações">
            <CommandItem
              value="action-stop-impersonation"
              onSelect={() =>
                run(() => {
                  sessionStorage.removeItem("impersonated_tenant_id");
                  toast.success("Impersonação encerrada");
                  navigate({ to: "/admin/tenants" });
                })
              }
            >
              <Search className="mr-2 h-4 w-4" />
              Encerrar impersonação
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
