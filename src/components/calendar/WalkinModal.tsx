import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

export function WalkinModal({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const [barberId, setBarberId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });

  const now = new Date();
  const [date, setDate] = useState(format(now, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(now, "HH:mm"));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [b, s, c] = await Promise.all([
        supabase.from("barbers").select("id, name").eq("user_id", user.id).order("name"),
        supabase.from("services").select("id, name, price, duration_minutes").eq("user_id", user.id).eq("active", true).order("name"),
        supabase.from("customers").select("id, name, phone").eq("user_id", user.id).order("name").limit(200),
      ]);
      setBarbers(b.data || []);
      setServices(s.data || []);
      setCustomers(c.data || []);
    })();
  }, [open, user]);

  useEffect(() => {
    if (!open) {
      setBarberId(""); setServiceId(""); setCustomerId("");
      setCustomerSearch(""); setCreatingCustomer(false);
      setNewCustomer({ name: "", phone: "", email: "" });
      setDate(format(new Date(), "yyyy-MM-dd"));
      setTime(format(new Date(), "HH:mm"));
    }
  }, [open]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20);
    const q = customerSearch.toLowerCase();
    return customers.filter((c) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q),
    ).slice(0, 20);
  }, [customerSearch, customers]);

  async function ensureCustomer(): Promise<string | null> {
    if (customerId) return customerId;
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error("Informe nome e telefone do cliente");
      return null;
    }
    const { data, error } = await supabase
      .from("customers")
      .insert({
        user_id: user!.id,
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message || "Erro ao cadastrar cliente");
      return null;
    }
    return data.id;
  }

  async function handleSubmit() {
    if (!user) return;
    if (!barberId) return toast.error("Selecione o profissional");
    if (!serviceId || !selectedService) return toast.error("Selecione o serviço");
    if (!date || !time) return toast.error("Informe data e horário");

    setSubmitting(true);
    try {
      const cid = await ensureCustomer();
      if (!cid) { setSubmitting(false); return; }

      const startISO = new Date(`${date}T${time}:00`).toISOString();
      const duration = Number(selectedService.duration_minutes) || 30;
      const endISO = new Date(new Date(startISO).getTime() + duration * 60000).toISOString();

      // Motor central: bloqueia sobreposição antes de chamar o RPC
      if (await hasConflict({ barberId, startISO, endISO })) {
        toast.error(OVERLAP_MESSAGE);
        setSubmitting(false);
        return;
      }



      const { data, error } = await supabase.rpc("create_walkin_appointment" as any, {
        p_tenant_id: user.id,
        p_barber_id: barberId,
        p_customer_id: cid,
        p_service_id: serviceId,
        p_start_time: startISO,
        p_duration_minutes: duration,
        p_total_price: Number(selectedService.price) || null,
        p_notes: null,
      });

      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(res?.error || "Não foi possível criar o atendimento");
        return;
      }

      toast.success("Atendimento presencial registrado — horário bloqueado.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar atendimento presencial");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#0B1220] border border-emerald-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-400">
            <UserPlus className="h-5 w-5" />
            Novo Atendimento Presencial
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-slate-400">Profissional *</Label>
            <Select value={barberId} onValueChange={setBarberId}>
              <SelectTrigger className="bg-black/40 border-white/10 mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-slate-400">Cliente *</Label>
            {!creatingCustomer ? (
              <div className="space-y-2 mt-1">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Buscar por nome ou telefone"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId(""); }}
                    className="pl-9 bg-black/40 border-white/10"
                  />
                </div>
                {customerSearch && filteredCustomers.length > 0 && !customerId && (
                  <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/40">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setCustomerId(c.id); setCustomerSearch(`${c.name} — ${c.phone || ""}`); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                      >
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-slate-400 ml-2">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCreatingCustomer(true)}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  + Cadastrar novo cliente
                </button>
              </div>
            ) : (
              <div className="space-y-2 mt-1 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <Input placeholder="Nome *" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="bg-black/40 border-white/10" />
                <Input placeholder="Telefone *" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="bg-black/40 border-white/10" />
                <Input placeholder="E-mail (opcional)" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className="bg-black/40 border-white/10" />
                <button type="button" onClick={() => setCreatingCustomer(false)} className="text-xs text-slate-400 hover:underline">
                  ← Buscar existente
                </button>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-slate-400">Serviço *</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="bg-black/40 border-white/10 mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.duration_minutes ?? 30}min — R$ {Number(s.price || 0).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-slate-400">Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-black/40 border-white/10 mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-slate-400">Horário *</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-black/40 border-white/10 mt-1" />
            </div>
          </div>

          {selectedService && (
            <div className="text-xs text-slate-400 bg-black/30 rounded-lg p-3 border border-white/5">
              Duração: <span className="text-white font-bold">{selectedService.duration_minutes ?? 30} min</span> •
              {" "}Valor: <span className="text-emerald-400 font-bold">R$ {Number(selectedService.price || 0).toFixed(2)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar atendimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
