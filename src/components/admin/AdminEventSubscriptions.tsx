import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, MessageCircle, Mail, Monitor, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitAdminEvent, type AdminEventKey } from "@/utils/emit-admin-event";

type CatalogItem = {
  event_key: string;
  category: string;
  label: string;
  description: string;
  default_severity: string;
};

type SubRow = {
  id?: string;
  user_id?: string;
  event_key: string;
  channel_panel: boolean;
  channel_push: boolean;
  channel_whatsapp: boolean;
  channel_email: boolean;
  whatsapp_phone: string | null;
  email_address: string | null;
  enabled: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  growth: "Crescimento",
  risk: "Risco / Churn",
  operational: "Operacional",
  financial: "Financeiro",
};

const CATEGORY_COLOR: Record<string, string> = {
  growth: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  risk: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  operational: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  financial: "text-purple-400 border-purple-500/30 bg-purple-500/10",
};

export function AdminEventSubscriptions() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultPhone, setDefaultPhone] = useState("");
  const [defaultEmail, setDefaultEmail] = useState("");
  const [rows, setRows] = useState<Record<string, SubRow>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["admin-event-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_admin_event_catalog");
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });

  const { data: subs = [], isLoading: subsLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["admin-event-subs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_event_subscriptions")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      return data as SubRow[];
    },
  });

  useEffect(() => {
    if (!catalog.length) return;
    const map: Record<string, SubRow> = {};
    const existing = new Map(subs.map((s) => [s.event_key, s]));
    let seedPhone = defaultPhone;
    let seedEmail = defaultEmail;
    for (const c of catalog) {
      const found = existing.get(c.event_key);
      if (found) {
        map[c.event_key] = { ...found };
        if (!seedPhone && found.whatsapp_phone) seedPhone = found.whatsapp_phone;
        if (!seedEmail && found.email_address) seedEmail = found.email_address;
      } else {
        map[c.event_key] = {
          event_key: c.event_key,
          channel_panel: true,
          channel_push: true,
          channel_whatsapp: false,
          channel_email: false,
          whatsapp_phone: null,
          email_address: null,
          enabled: true,
        };
      }
    }
    setRows(map);
    if (seedPhone && !defaultPhone) setDefaultPhone(seedPhone);
    if (seedEmail && !defaultEmail) setDefaultEmail(seedEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, subs]);

  const grouped = useMemo(() => {
    const g: Record<string, CatalogItem[]> = {};
    for (const c of catalog) {
      (g[c.category] ??= []).push(c);
    }
    return g;
  }, [catalog]);

  const updateRow = (key: string, patch: Partial<SubRow>) => {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão não encontrada");
      const payload = Object.values(rows).map((r) => ({
        user_id: userId,
        event_key: r.event_key,
        channel_panel: r.channel_panel,
        channel_push: r.channel_push,
        channel_whatsapp: r.channel_whatsapp,
        channel_email: r.channel_email,
        whatsapp_phone: r.channel_whatsapp ? defaultPhone || null : null,
        email_address: r.channel_email ? defaultEmail || null : null,
        enabled: r.enabled,
      }));
      const { error } = await supabase
        .from("admin_event_subscriptions")
        .upsert(payload, { onConflict: "user_id,event_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferências salvas");
      queryClient.invalidateQueries({ queryKey: ["admin-event-subs", userId] });
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const [testing, setTesting] = useState<string | null>(null);
  const fireTest = async (item: CatalogItem) => {
    setTesting(item.event_key);
    try {
      await emitAdminEvent({
        event_key: item.event_key as AdminEventKey,
        title: `[TESTE] ${item.label}`,
        message: `Disparo de teste do evento ${item.event_key}`,
        severity: item.default_severity as "info" | "warning" | "critical",
      });
      toast.success("Evento de teste disparado");
    } catch (e: any) {
      toast.error("Falha no teste: " + e.message);
    } finally {
      setTesting(null);
    }
  };

  if (catalogLoading || subsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando preferências…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="glass border-white/5 rounded-[2.5rem] p-8">
        <CardHeader className="p-0 pb-6">
          <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-300" /> Meus canais de contato
          </CardTitle>
          <CardDescription>
            Usados para os eventos com WhatsApp ou e-mail habilitados abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-gray-400">WhatsApp</label>
            <Input
              value={defaultPhone}
              onChange={(e) => setDefaultPhone(e.target.value)}
              placeholder="5511999999999"
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-gray-400">E-mail</label>
            <Input
              value={defaultEmail}
              onChange={(e) => setDefaultEmail(e.target.value)}
              placeholder="voce@barbex.shop"
              className="bg-white/5 border-white/10"
            />
          </div>
        </CardContent>
      </Card>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category} className="glass border-white/5 rounded-2xl p-5">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={cn("border text-[10px]", CATEGORY_COLOR[category])}>
                {CATEGORY_LABEL[category] ?? category}
              </Badge>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {items.length} eventos
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-2">
            {items.map((item) => {
              const row = rows[item.event_key];
              if (!row) return null;
              return (
                <div
                  key={item.event_key}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{item.label}</div>
                      <div className="text-[11px] text-gray-400 line-clamp-1">{item.description}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(v) => updateRow(item.event_key, { enabled: v })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testing === item.event_key}
                        onClick={() => fireTest(item)}
                        className="h-7 w-7 p-0"
                      >
                        {testing === item.event_key ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-white/5",
                      !row.enabled && "opacity-40 pointer-events-none",
                    )}
                  >
                    <ChannelToggle
                      icon={<Monitor className="w-3 h-3" />}
                      label="Painel"
                      checked={row.channel_panel}
                      onChange={(v) => updateRow(item.event_key, { channel_panel: v })}
                    />
                    <ChannelToggle
                      icon={<Bell className="w-3 h-3" />}
                      label="Push"
                      checked={row.channel_push}
                      onChange={(v) => updateRow(item.event_key, { channel_push: v })}
                    />
                    <ChannelToggle
                      icon={<MessageCircle className="w-3 h-3" />}
                      label="Zap"
                      checked={row.channel_whatsapp}
                      onChange={(v) => updateRow(item.event_key, { channel_whatsapp: v })}
                    />
                    <ChannelToggle
                      icon={<Mail className="w-3 h-3" />}
                      label="E-mail"
                      checked={row.channel_email}
                      onChange={(v) => updateRow(item.event_key, { channel_email: v })}
                      disabled
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}


      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black uppercase tracking-widest"
        >
          {saveMutation.isPending ? "Salvando…" : "Salvar preferências"}
        </Button>
      </div>
    </div>
  );
}

function ChannelToggle({
  icon,
  label,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border border-white/10 bg-black/30",
        disabled && "opacity-40",
      )}
    >
      <span className="flex items-center gap-1 text-[10px] text-gray-300 uppercase tracking-wide">
        {icon} {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="scale-75 origin-right" />
    </label>
  );
}
