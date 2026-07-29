import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Zap, Copy, Loader2 } from "lucide-react";

interface WebhooksCardProps {
  tenantId: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  event: string;
  secret: string | null;
  active: boolean;
  created_at: string;
}

const EVENT_OPTIONS = [
  { value: "all", label: "Todos os eventos" },
  { value: "appointment.created", label: "Agendamento criado" },
  { value: "appointment.updated", label: "Agendamento atualizado" },
  { value: "appointment.canceled", label: "Agendamento cancelado" },
  { value: "customer.created", label: "Cliente criado" },
  { value: "payment.received", label: "Pagamento recebido" },
];

export function WebhooksCard({ tenantId }: WebhooksCardProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    url: "",
    event: "all",
    secret: "",
  });

  useEffect(() => {
    void fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function fetchWebhooks() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("tenant_webhooks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar webhooks");
    } else {
      setWebhooks((data ?? []) as Webhook[]);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      toast.error("Preencha nome e URL");
      return;
    }
    try {
      new URL(form.url);
    } catch {
      toast.error("URL inválida");
      return;
    }

    setSaving(true);
    const { error } = await (supabase as any).from("tenant_webhooks").insert({
      tenant_id: tenantId,
      name: form.name.trim(),
      url: form.url.trim(),
      event: form.event,
      secret: form.secret.trim() || null,
      active: true,
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao criar webhook");
    } else {
      toast.success("Webhook criado!");
      setForm({ name: "", url: "", event: "all", secret: "" });
      setOpen(false);
      void fetchWebhooks();
    }
  }

  async function toggleActive(wh: Webhook) {
    const { error } = await (supabase as any)
      .from("tenant_webhooks")
      .update({ active: !wh.active })
      .eq("id", wh.id);

    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      setWebhooks((prev) =>
        prev.map((w) => (w.id === wh.id ? { ...w, active: !w.active } : w))
      );
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este webhook?")) return;
    const { error } = await (supabase as any)
      .from("tenant_webhooks")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao remover");
    } else {
      toast.success("Webhook removido");
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  return (
    <Card className="md:col-span-2 flex flex-col bg-[#0b0f17] border border-zinc-800/80 text-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(245,158,11,0.06)] hover:border-[#f59e0b]/30 transition-all">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 grid place-items-center shrink-0">
              <Zap size={20} className="text-[#f59e0b]" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Webhooks Customizados</CardTitle>
              <CardDescription className="text-zinc-400">
                Envie eventos da sua barbearia para Zapier, Make, n8n ou qualquer URL.
              </CardDescription>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-[38px] px-4 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] transition-all hover:-translate-y-0.5"
              >
                <Plus size={16} className="mr-1.5" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Webhook</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Configure uma URL que receberá eventos via POST.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Notificação Zapier"
                    className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-[#f59e0b]/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">URL de destino</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://hooks.zapier.com/..."
                    className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-[#f59e0b]/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Evento</Label>
                  <Select value={form.event} onValueChange={(v) => setForm({ ...form, event: v })}>
                    <SelectTrigger className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f17] border-zinc-800 text-white">
                      {EVENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Segredo (opcional)
                  </Label>
                  <Input
                    value={form.secret}
                    onChange={(e) => setForm({ ...form, secret: e.target.value })}
                    placeholder="Para validação HMAC"
                    className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-[#f59e0b]/50"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className="h-[38px] rounded-xl text-zinc-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-[38px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold"
                  >
                    {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                    Criar Webhook
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-zinc-800 rounded-xl bg-[#05070d]">
            <Zap size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Nenhum webhook configurado.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Clique em <span className="text-[#f59e0b] font-semibold">Novo</span> para criar o primeiro.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 bg-[#05070d] border border-zinc-800/80 rounded-xl hover:border-[#f59e0b]/30 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-white truncate">{wh.name}</p>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-black uppercase tracking-widest border-zinc-700 text-zinc-400 px-2 py-0"
                    >
                      {EVENT_OPTIONS.find((e) => e.value === wh.event)?.label ?? wh.event}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(wh.url)}
                    className="text-xs text-zinc-500 hover:text-[#f59e0b] truncate flex items-center gap-1.5 font-mono"
                    title="Copiar URL"
                  >
                    <Copy size={11} />
                    <span className="truncate">{wh.url}</span>
                  </button>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={wh.active}
                    onCheckedChange={() => toggleActive(wh)}
                    className="data-[state=checked]:bg-[#f59e0b]"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(wh.id)}
                    className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
