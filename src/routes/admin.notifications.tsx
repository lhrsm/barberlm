import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell, Check, Trash2, Archive, ExternalLink, AlertTriangle,
  CreditCard, LifeBuoy, MessageCircle, Building2, ShieldAlert, Search,
} from "lucide-react";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotificationsPage,
});

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  description: string | null;
  priority: string | null;
  is_read: boolean | null;
  read_at: string | null;
  archived: boolean | null;
  tenant_id: string | null;
  action_url: string | null;
  created_at: string;
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "border-white/10 bg-white/5 text-gray-300",
  normal: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  critical: "border-red-500/50 bg-red-500/15 text-red-200",
};

const TYPE_ICON: Record<string, JSX.Element> = {
  new_tenant: <Building2 className="h-4 w-4 text-emerald-400" />,
  trial_started: <Building2 className="h-4 w-4 text-emerald-400" />,
  subscription_paid: <CreditCard className="h-4 w-4 text-emerald-400" />,
  subscription_failed: <AlertTriangle className="h-4 w-4 text-red-400" />,
  subscription_cancelled: <CreditCard className="h-4 w-4 text-orange-400" />,
  plan_upgraded: <CreditCard className="h-4 w-4 text-amber-400" />,
  plan_downgraded: <CreditCard className="h-4 w-4 text-gray-400" />,
  support_ticket_created: <LifeBuoy className="h-4 w-4 text-purple-400" />,
  support_ticket_replied: <MessageCircle className="h-4 w-4 text-purple-400" />,
  lgpd_request: <ShieldAlert className="h-4 w-4 text-amber-300" />,
  payment_webhook_error: <AlertTriangle className="h-4 w-4 text-red-400" />,
  integration_error: <AlertTriangle className="h-4 w-4 text-red-400" />,
  custom_plan_request: <CreditCard className="h-4 w-4 text-amber-400" />,
  system_alert: <Bell className="h-4 w-4 text-gray-300" />,
};

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "Não lidas" },
  { id: "high", label: "Alta prioridade" },
  { id: "payments", label: "Pagamentos", types: ["subscription_paid","subscription_failed","subscription_cancelled","payment_webhook_error"] },
  { id: "support", label: "Suporte", types: ["support_ticket_created","support_ticket_replied"] },
  { id: "subscriptions", label: "Assinaturas", types: ["new_tenant","trial_started","plan_upgraded","plan_downgraded","custom_plan_request"] },
  { id: "system", label: "Sistema", types: ["system_alert","integration_error"] },
  { id: "lgpd", label: "LGPD", types: ["lgpd_request"] },
] as const;

const PERIODS = [
  { id: "today", label: "Hoje", days: 1 },
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "all", label: "Tudo", days: 0 },
] as const;

function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [period, setPeriod] = useState<string>("30d");
  const [search, setSearch] = useState("");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["admin-notifications-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as NotificationRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications-page-realtime")
      .on("postgres_changes", { event: "*", table: "admin_notifications", schema: "public" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-notifications-all"] });
        queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications-all"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("admin_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todas as notificações marcadas como lidas");
      queryClient.invalidateQueries({ queryKey: ["admin-notifications-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notifications").update({ archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notificação arquivada"); queryClient.invalidateQueries({ queryKey: ["admin-notifications-all"] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notificação excluída"); queryClient.invalidateQueries({ queryKey: ["admin-notifications-all"] }); },
  });

  const filtered = useMemo(() => {
    if (!notifications) return [];
    const now = Date.now();
    const days = PERIODS.find(p => p.id === period)?.days ?? 0;
    return notifications.filter(n => {
      if (n.archived) return false;
      if (days > 0 && now - new Date(n.created_at).getTime() > days * 86400000) return false;
      const f = FILTERS.find(x => x.id === filter);
      if (f) {
        if (f.id === "unread" && n.is_read) return false;
        if (f.id === "high" && !(n.priority === "high" || n.priority === "critical")) return false;
        if ("types" in f && f.types && !f.types.includes(n.type)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!`${n.title} ${n.message ?? n.description ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [notifications, filter, period, search]);

  const unreadCount = notifications?.filter(n => !n.is_read && !n.archived).length ?? 0;

  const handleClick = (n: NotificationRow) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.action_url) navigate({ to: n.action_url as any });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-7 w-7 text-amber-400" />
            Central de Notificações
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {unreadCount} não lidas • acompanhe cadastros, pagamentos e eventos críticos do SaaS.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0}
          >
            <Check className="w-4 h-4 mr-2" /> Marcar todas como lidas
          </Button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                filter === f.id
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,.35)]"
                  : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                period === p.id ? "border-amber-400 text-amber-200 bg-amber-500/10" : "border-white/10 text-gray-400 hover:text-white"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título ou mensagem..."
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando notificações...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl">
            Nenhuma notificação para os filtros selecionados.
          </div>
        ) : (
          filtered.map(n => {
            const priority = n.priority || "normal";
            return (
              <div
                key={n.id}
                className={cn(
                  "group rounded-xl border p-4 flex gap-4 items-start transition-all hover:bg-white/[.04]",
                  PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal,
                  !n.is_read && "ring-1 ring-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,.08)]"
                )}
              >
                <div className="mt-1 p-2 rounded-lg bg-black/40 border border-white/10">
                  {TYPE_ICON[n.type] || <Bell className="h-4 w-4 text-gray-300" />}
                </div>
                <button onClick={() => handleClick(n)} className="flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{n.title}</span>
                    <Badge className={cn("text-[10px] uppercase tracking-wider", PRIORITY_STYLES[priority])}>
                      {priority}
                    </Badge>
                    {!n.is_read && (
                      <span className="text-[10px] font-bold text-amber-300 uppercase">Nova</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{n.message || n.description}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </button>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {n.action_url && (
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleClick(n)}>
                      Abrir <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  {!n.is_read && (
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => markRead.mutate(n.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => archive.mutate(n.id)}>
                    <Archive className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-red-300 hover:text-red-200" onClick={() => remove.mutate(n.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
