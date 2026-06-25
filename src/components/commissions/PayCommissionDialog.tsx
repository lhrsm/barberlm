import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type PendingCommission = {
  id: string;
  appointment_id: string;
  customer_name: string | null;
  service_name: string | null;
  service_amount: number;
  commission_amount: number;
  status: string;
  appointment_date: string | null;
  created_at: string;
};

type PayCommissionDialogProps = {
  tenantId: string;
  barberId: string;
  barberName: string;
  startDate?: string | null;
  endDate?: string | null;
  pendingAmount?: number;
  pendingCount?: number;
  triggerClassName?: string;
  triggerLabel?: string;
  onPaid?: () => void;
};

const fmt = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PayCommissionDialog({
  tenantId,
  barberId,
  barberName,
  startDate,
  endDate,
  pendingAmount = 0,
  pendingCount = 0,
  triggerClassName,
  triggerLabel = "Pagar Comissão",
  onPaid,
}: PayCommissionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [items, setItems] = useState<PendingCommission[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const selectedTotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.commission_amount || 0),
    0
  );

  const periodLabel = (() => {
    if (startDate && endDate) return `${startDate} até ${endDate}`;
    if (startDate) return `A partir de ${startDate}`;
    if (endDate) return `Até ${endDate}`;
    return "Todas as pendências";
  })();

  async function loadPending() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_barber_pending_commissions", {
        p_tenant_id: tenantId,
        p_barber_id: barberId,
        p_start_date: startDate || undefined,
        p_end_date: endDate || undefined,
      });
      if (error) throw error;
      const list = (Array.isArray(data) ? data : []) as PendingCommission[];
      setItems(list);
      setSelectedIds(list.map((item) => item.id));
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar comissões pendentes");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenChange(value: boolean) {
    setOpen(value);
    if (value) await loadPending();
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? items.map((item) => item.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((itemId) => itemId !== id)
    );
  }

  async function confirmPayment() {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos uma comissão para pagar.");
      return;
    }
    setPaying(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("pay_barber_commissions", {
        p_tenant_id: tenantId,
        p_barber_id: barberId,
        p_commission_ids: selectedIds,
        p_paid_by: auth.user?.id || tenantId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Falha ao pagar comissão");
      toast.success(`${result.paid_count} comissão(ões) pagas: ${fmt(Number(result.paid_total || selectedTotal))}`);
      setOpen(false);
      onPaid?.();
    } catch (error: any) {
      toast.error(error.message || "Erro ao confirmar pagamento");
    } finally {
      setPaying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          disabled={pendingAmount <= 0 && pendingCount <= 0}
          className={cn(
            "h-10 gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-black rounded-xl disabled:opacity-50",
            triggerClassName
          )}
        >
          <CheckCircle2 className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-[#0b0f17] border-amber-500/20 text-white max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-white">Pagar comissão do barbeiro</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Barbeiro</p>
            <p className="font-black text-white mt-1">{barberName}</p>
          </div>
          <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total pendente</p>
            <p className="font-black text-amber-400 mt-1">{fmt(items.reduce((s, i) => s + Number(i.commission_amount || 0), 0) || pendingAmount)}</p>
          </div>
          <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Atendimentos</p>
            <p className="font-black text-white mt-1">{items.length || pendingCount}</p>
          </div>
          <div className="rounded-xl border border-amber-500/10 bg-[#05070d] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Período</p>
            <p className="font-black text-white mt-1 text-sm">{periodLabel}</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/10 overflow-hidden flex-1 min-h-[260px]">
          <div className="flex items-center justify-between gap-3 bg-[#05070d] border-b border-amber-500/10 p-4">
            <label className="flex items-center gap-3 text-sm font-bold text-white cursor-pointer">
              <Checkbox
                checked={items.length > 0 && selectedIds.length === items.length}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
              Selecionar todas
            </label>
            <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/20">
              Selecionado: {fmt(selectedTotal)}
            </Badge>
          </div>

          <div className="overflow-auto max-h-[380px]">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#05070d] sticky top-0 z-10">
                <tr className="border-b border-amber-500/10">
                  <th className="w-12 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Data</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Serviço</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-amber-400 uppercase tracking-widest">Valor</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-amber-400 uppercase tracking-widest">Comissão</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/5">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-zinc-500"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando comissões...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-zinc-500 italic">Nenhuma comissão pendente para este barbeiro.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-500/5">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={(checked) => toggleOne(item.id, checked === true)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-white">
                      {format(new Date(item.appointment_date || item.created_at), "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{item.customer_name || "Cliente"}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{item.service_name || "Serviço"}</td>
                    <td className="px-4 py-3 text-sm text-right text-white font-bold">{fmt(Number(item.service_amount || 0))}</td>
                    <td className="px-4 py-3 text-sm text-right text-amber-400 font-black">{fmt(Number(item.commission_amount || 0))}</td>
                    <td className="px-4 py-3"><Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Pendente</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700 bg-transparent text-white hover:bg-zinc-800">
            Cancelar
          </Button>
          <Button onClick={confirmPayment} disabled={paying || selectedIds.length === 0} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black">
            {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}