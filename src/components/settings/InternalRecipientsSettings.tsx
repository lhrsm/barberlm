import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BellRing, Pencil, Plus, Trash2, Users } from "lucide-react";

type Recipient = {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  barber_id: string | null;
  receive_whatsapp: boolean;
  receive_email: boolean;
  receive_panel: boolean;
  notify_new_appointment: boolean;
  notify_rescheduled_appointment: boolean;
  notify_cancelled_appointment: boolean;
  notify_completed_appointment: boolean;
  notify_new_subscription: boolean;
  notify_subscription_cancelled: boolean;
  notify_payment_received: boolean;
  notify_payment_failed: boolean;
  notify_review_received: boolean;
  notify_bad_review: boolean;
  notify_support_ticket: boolean;
  notify_automation_failure: boolean;
  is_active: boolean;
};

type BarberOpt = { id: string; name: string };

const EVENT_FLAGS: Array<{ key: keyof Recipient; label: string }> = [
  { key: "notify_new_appointment", label: "Novo agendamento" },
  { key: "notify_rescheduled_appointment", label: "Reagendamento" },
  { key: "notify_cancelled_appointment", label: "Cancelamento" },
  { key: "notify_completed_appointment", label: "Atendimento concluído" },
  { key: "notify_new_subscription", label: "Novo assinante" },
  { key: "notify_subscription_cancelled", label: "Assinatura cancelada" },
  { key: "notify_payment_received", label: "Pagamento confirmado" },
  { key: "notify_payment_failed", label: "Falha em pagamento" },
  { key: "notify_review_received", label: "Avaliação recebida" },
  { key: "notify_bad_review", label: "Avaliação negativa" },
  { key: "notify_support_ticket", label: "Novo chamado de suporte" },
  { key: "notify_automation_failure", label: "Falha em automação" },
];

const ROLE_OPTIONS = [
  { value: "owner", label: "Dono" },
  { value: "manager", label: "Gerente" },
  { value: "reception", label: "Recepção" },
  { value: "barber", label: "Barbeiro" },
  { value: "other", label: "Outro" },
];

function normalizePhoneDigits(p: string): string {
  const d = p.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : d.length >= 10 ? `55${d}` : d;
}

function emptyRecipient(tenantId: string): Recipient {
  return {
    id: "",
    tenant_id: tenantId,
    name: "",
    role: "manager",
    phone: "",
    email: "",
    barber_id: null,
    receive_whatsapp: true,
    receive_email: false,
    receive_panel: true,
    notify_new_appointment: true,
    notify_rescheduled_appointment: true,
    notify_cancelled_appointment: true,
    notify_completed_appointment: false,
    notify_new_subscription: true,
    notify_subscription_cancelled: true,
    notify_payment_received: true,
    notify_payment_failed: true,
    notify_review_received: false,
    notify_bad_review: true,
    notify_support_ticket: false,
    notify_automation_failure: false,
    is_active: true,
  };
}

export function InternalRecipientsSettings() {
  const { tenantId, tenantProfile } = useTenant();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Recipient | null>(null);
  const [allowOnOfficial, setAllowOnOfficial] = useState(false);

  useEffect(() => {
    setAllowOnOfficial(Boolean((tenantProfile as any)?.allow_notifications_on_business_phone));
  }, [tenantProfile]);

  useEffect(() => {
    if (!tenantId) return;
    fetchAll();
  }, [tenantId]);

  async function fetchAll() {
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_recipients" as any)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error("Erro ao carregar destinatários");
    setRecipients((data as any) || []);
    setLoading(false);
  }

  async function toggleAllowOnOfficial(v: boolean) {
    setAllowOnOfficial(v);
    if (!tenantId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ allow_notifications_on_business_phone: v } as any)
      .eq("id", tenantId);
    if (error) toast.error("Erro ao salvar preferência");
    else toast.success("Preferência atualizada");
  }

  function openNew() {
    if (!tenantId) return;
    setDraft(emptyRecipient(tenantId));
    setDialogOpen(true);
  }

  function openEdit(r: Recipient) {
    setDraft({ ...r });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft || !tenantId) return;
    if (!draft.name.trim()) return toast.error("Informe o nome");
    const phoneDigits = normalizePhoneDigits(draft.phone || "");
    if (draft.receive_whatsapp && !phoneDigits) return toast.error("Telefone inválido");

    const officialDigits = normalizePhoneDigits((tenantProfile as any)?.whatsapp_number || "");
    if (
      phoneDigits &&
      officialDigits &&
      phoneDigits === officialDigits &&
      !allowOnOfficial
    ) {
      toast.warning(
        "Este número é o WhatsApp oficial. Ative 'Receber notificações internas no número oficial' acima para permitir.",
      );
    }

    const payload = { ...draft, phone: phoneDigits || null };
    if (draft.id) {
      const { error } = await supabase
        .from("notification_recipients" as any)
        .update(payload as any)
        .eq("id", draft.id);
      if (error) return toast.error(error.message);
    } else {
      const { id, ...insertData } = payload as any;
      const { error } = await supabase.from("notification_recipients" as any).insert(insertData);
      if (error) return toast.error(error.message);
    }
    toast.success("Destinatário salvo");
    setDialogOpen(false);
    setDraft(null);
    fetchAll();
  }

  async function remove(id: string) {
    if (!confirm("Remover este destinatário?")) return;
    const { error } = await supabase.from("notification_recipients" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchAll();
  }

  async function toggleActive(r: Recipient) {
    const { error } = await supabase
      .from("notification_recipients" as any)
      .update({ is_active: !r.is_active } as any)
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    fetchAll();
  }

  return (
    <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
      <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
        <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
          <BellRing className="text-[#ea580c] h-5 w-5" />
          Destinatários de Notificações Internas
        </CardTitle>
        <CardDescription className="text-slate-400">
          Gerente, recepção, dono e outros membros que recebem avisos administrativos.
          O WhatsApp oficial da barbearia é usado apenas para <b>enviar</b> as mensagens.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between p-4 bg-[#05070d] border border-[#1f2937] rounded-2xl">
          <div>
            <p className="text-sm font-bold text-white">Receber também no WhatsApp oficial</p>
            <p className="text-xs text-slate-500">
              Se ativado, o próprio número de atendimento pode figurar como destinatário interno.
            </p>
          </div>
          <Switch checked={allowOnOfficial} onCheckedChange={toggleAllowOnOfficial} />
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
            <Users className="h-4 w-4" /> {recipients.length} destinatário(s)
          </div>
          <Button
            onClick={openNew}
            size="sm"
            className="bg-[#ea580c] hover:bg-[#c2410c] text-black font-black uppercase tracking-wider text-[11px] h-9 px-4 rounded-lg shadow-md shadow-[#ea580c]/20"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
          </Button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Carregando...</p>
        ) : recipients.length === 0 ? (
          <div className="text-center py-8 bg-[#05070d]/50 rounded-2xl border border-dashed border-[#1f2937]">
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
              Nenhum destinatário cadastrado.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recipients.map((r) => {
              const events = EVENT_FLAGS.filter((f) => (r as any)[f.key]).length;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-4 bg-[#05070d] border border-[#1f2937] rounded-2xl hover:border-[#ea580c]/40 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-white truncate">{r.name}</span>
                      <Badge className="bg-[#ea580c]/10 text-[#ea580c] border-[#ea580c]/30 text-[10px] uppercase tracking-widest">
                        {ROLE_OPTIONS.find((x) => x.value === r.role)?.label || r.role}
                      </Badge>
                      {!r.is_active && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-rose-500/40 text-rose-400">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {r.phone || "Sem telefone"} · {events} evento(s) ·{" "}
                      {[r.receive_whatsapp && "WhatsApp", r.receive_panel && "Painel", r.receive_email && "Email"]
                        .filter(Boolean)
                        .join(" · ") || "Nenhum canal"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                    <Button
                      size="sm"
                      onClick={() => openEdit(r)}
                      className="h-9 px-3 rounded-lg bg-transparent border border-[#1f2937] text-slate-200 hover:bg-[#ea580c]/10 hover:border-[#ea580c]/40 hover:text-[#ea580c] font-bold uppercase text-[11px] tracking-widest transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => remove(r.id)}
                      className="h-9 px-3 rounded-lg bg-transparent border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/60 hover:text-rose-300 font-bold uppercase text-[11px] tracking-widest transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0b0f17] border border-[#1f2937] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase italic tracking-wider">
              {draft?.id ? "Editar destinatário" : "Novo destinatário"}
            </DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="bg-[#05070d] border-[#1f2937] mt-1"
                  />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v })}>
                    <SelectTrigger className="bg-[#05070d] border-[#1f2937] mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>WhatsApp (com DDI)</Label>
                  <Input
                    value={draft.phone || ""}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    placeholder="5571999999999"
                    className="bg-[#05070d] border-[#1f2937] mt-1"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={draft.email || ""}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className="bg-[#05070d] border-[#1f2937] mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-widest text-slate-400">Canais</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {(["receive_whatsapp", "receive_panel", "receive_email"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm bg-[#05070d] border border-[#1f2937] rounded-xl px-3 py-2">
                      <Switch
                        checked={(draft as any)[k]}
                        onCheckedChange={(v) => setDraft({ ...draft, [k]: v } as Recipient)}
                      />
                      <span>{k === "receive_whatsapp" ? "WhatsApp" : k === "receive_panel" ? "Painel" : "Email"}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-widest text-slate-400">Eventos</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {EVENT_FLAGS.map((f) => (
                    <label
                      key={f.key as string}
                      className="flex items-center justify-between gap-2 text-sm bg-[#05070d] border border-[#1f2937] rounded-xl px-3 py-2"
                    >
                      <span className="text-slate-300">{f.label}</span>
                      <Switch
                        checked={(draft as any)[f.key]}
                        onCheckedChange={(v) => setDraft({ ...draft, [f.key]: v } as Recipient)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-[#05070d] border border-[#1f2937] rounded-xl">
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
                <span className="text-sm">Ativo</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-[#ea580c] hover:bg-[#c2410c] text-black font-black" onClick={save}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
