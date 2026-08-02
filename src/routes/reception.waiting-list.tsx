import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReception } from "@/hooks/use-reception";
import { toast } from "sonner";

export const Route = createFileRoute("/reception/waiting-list")({
  head: () => ({
    meta: [
      { title: "Lista de Espera | Recepção Barbex" },
      { name: "description", content: "Gerencie encaixes e clientes aguardando horário na barbearia." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Lista de Espera | Recepção Barbex" },
      { property: "og:description", content: "Encaixes e clientes aguardando horário." },
    ],
  }),
  component: WaitingListPage,
});

const STATUSES = [
  { value: "aguardando", label: "Aguardando" },
  { value: "contatado", label: "Contatado" },
  { value: "encaixado", label: "Encaixado" },
  { value: "desistiu", label: "Desistiu" },
  { value: "expirado", label: "Expirado" },
];

const STATUS_TONE: Record<string, string> = {
  aguardando: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  contatado: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  encaixado: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  desistiu: "bg-destructive/15 text-destructive",
  expirado: "bg-muted text-muted-foreground",
};

const EMPTY = {
  customer_name: "",
  phone: "",
  service_id: "",
  barber_id: "",
  preferred_date: "",
  time_range: "",
  priority: "normal",
  notes: "",
};

function WaitingListPage() {
  const { tenantId, can, user } = useReception();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const canManage = can("manage_waiting_list");

  const { data: items, isLoading } = useQuery({
    queryKey: ["waiting-list", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waiting_list")
        .select("*, services(name), barbers(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["reception-services", tenantId],
    enabled: !!tenantId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
  });

  const { data: barbers } = useQuery({
    queryKey: ["reception-barbers", tenantId],
    enabled: !!tenantId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  async function save() {
    if (!form.customer_name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("waiting_list").insert({
      tenant_id: tenantId!,
      customer_name: form.customer_name.trim(),
      phone: form.phone || null,
      service_id: form.service_id || null,
      barber_id: form.barber_id || null,
      preferred_date: form.preferred_date || null,
      time_range: form.time_range || null,
      priority: form.priority,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cliente adicionado à lista de espera.");
    setForm({ ...EMPTY });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
  }

  async function changeStatus(id: string, status: string) {
    const { error } = await supabase.from("waiting_list").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
  }

  async function remove(id: string) {
    if (!confirm("Remover este registro da lista de espera?")) return;
    const { error } = await supabase.from("waiting_list").delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lista de espera</h1>
          <p className="text-sm text-muted-foreground">
            Clientes aguardando encaixe ou horário disponível.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden /> Adicionar
          </Button>
        )}
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (items || []).length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum cliente na lista de espera.
        </Card>
      ) : (
        <ul className="space-y-3">
          {(items || []).map((item: any) => (
            <li key={item.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{item.customer_name}</p>
                    <Badge variant="secondary" className={`border-0 text-[11px] ${STATUS_TONE[item.status] || ""}`}>
                      {STATUSES.find((s) => s.value === item.status)?.label || item.status}
                    </Badge>
                    {item.priority === "alta" && (
                      <Badge variant="outline" className="text-[11px]">Prioridade alta</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.phone || "sem telefone"} · {item.services?.name || "qualquer serviço"} ·{" "}
                    {item.barbers?.name || "qualquer profissional"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.preferred_date || "data flexível"}
                    {item.time_range ? ` · ${item.time_range}` : ""}
                  </p>
                  {item.notes && <p className="mt-1 text-[11px] italic text-muted-foreground">{item.notes}</p>}
                </div>

                {canManage && (
                  <div className="flex items-center gap-2">
                    <Select value={item.status} onValueChange={(v) => changeStatus(item.id, v)}>
                      <SelectTrigger className="w-40" aria-label="Alterar situação">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover da lista"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar à lista de espera</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="wl-name">Cliente</Label>
              <Input
                id="wl-name"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wl-phone">WhatsApp</Label>
              <Input id="wl-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Serviço desejado</Label>
                <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    {(services || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Profissional preferido</Label>
                <Select value={form.barber_id} onValueChange={(v) => setForm({ ...form, barber_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    {(barbers || []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="wl-date">Data preferida</Label>
                <Input
                  id="wl-date"
                  type="date"
                  value={form.preferred_date}
                  onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wl-range">Faixa de horário</Label>
                <Input
                  id="wl-range"
                  placeholder="Ex.: 14h às 18h"
                  value={form.time_range}
                  onChange={(e) => setForm({ ...form, time_range: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wl-notes">Observação</Label>
              <Textarea
                id="wl-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
