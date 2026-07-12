import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, CreditCard, QrCode, Wallet, Sparkles } from "lucide-react";

interface SplitPaymentModalProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type BreakdownKey = "cash" | "credit_card" | "debit_card" | "pix" | "other";

const METHODS: { key: BreakdownKey; label: string; icon: React.ComponentType<any> }[] = [
  { key: "cash", label: "Dinheiro", icon: Banknote },
  { key: "pix", label: "PIX", icon: QrCode },
  { key: "credit_card", label: "Crédito", icon: CreditCard },
  { key: "debit_card", label: "Débito", icon: CreditCard },
  { key: "other", label: "Outro", icon: Wallet },
];

const money = (n: number) => `R$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

export function SplitPaymentModal({ appointment, open, onOpenChange, onSuccess }: SplitPaymentModalProps) {
  const initialService = Number(
    appointment?.service_amount ?? appointment?.services?.price ?? appointment?.original_total ?? 0
  );
  const initialProducts = Number(appointment?.products_amount ?? 0);

  const [service, setService] = React.useState(initialService);
  const [products, setProducts] = React.useState(initialProducts);
  const [discount, setDiscount] = React.useState(Number(appointment?.discount_amount ?? 0));
  const [tipPreset, setTipPreset] = React.useState<number | "custom" | null>(null);
  const [tip, setTip] = React.useState(Number(appointment?.tip_amount ?? 0));
  const [breakdown, setBreakdown] = React.useState<Record<BreakdownKey, number>>({
    cash: 0, credit_card: 0, debit_card: 0, pix: 0, other: 0,
  });
  const [loading, setLoading] = React.useState(false);

  // Recompute products from live items on open
  React.useEffect(() => {
    if (!open || !appointment?.id) return;
    (async () => {
      const { data } = await supabase
        .from("product_sales")
        .select("total_price")
        .eq("appointment_id", appointment.id);
      if (data) {
        const sum = data.reduce((acc, r: any) => acc + Number(r.total_price || 0), 0);
        setProducts(sum);
      }
      setService(initialService);
      setDiscount(Number(appointment?.discount_amount ?? 0));
      setTip(Number(appointment?.tip_amount ?? 0));
      setTipPreset(null);
      setBreakdown({ cash: 0, credit_card: 0, debit_card: 0, pix: 0, other: 0 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  const subtotal = Math.max(0, service + products);
  const total = Math.max(0, subtotal + tip - discount);
  const paid = Object.values(breakdown).reduce((a, b) => a + Number(b || 0), 0);
  const remaining = Math.round((total - paid) * 100) / 100;
  const balanced = Math.abs(remaining) < 0.01;

  const applyTipPreset = (pct: number | "custom") => {
    setTipPreset(pct);
    if (pct === "custom") return;
    setTip(Math.round(service * (pct / 100) * 100) / 100);
  };

  const autoFill = (key: BreakdownKey) => {
    const missing = Math.max(0, remaining);
    setBreakdown((b) => ({ ...b, [key]: Math.round((Number(b[key] || 0) + missing) * 100) / 100 }));
  };

  const submit = async () => {
    if (!balanced) {
      toast.error(`Faltam ${money(remaining)} para fechar o pagamento`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("settle_appointment_payment", {
        p_appointment_id: appointment.id,
        p_service_amount: service,
        p_products_amount: products,
        p_tip_amount: tip,
        p_discount_amount: discount,
        p_payment_breakdown: breakdown as any,
        p_tip_barber_id: appointment.barber_id ?? null,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(res?.error || "Não foi possível fechar o pagamento");
        return;
      }
      toast.success(`Pagamento fechado — ${money(res.final_amount)}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao fechar pagamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-zinc-950 border border-[#D4AF37]/40 text-white">
        <DialogHeader>
          <DialogTitle className="text-[#D4AF37] flex items-center gap-2 font-black uppercase tracking-widest text-sm">
            <Sparkles className="h-4 w-4" /> Fechar Pagamento
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Divida entre serviço, produtos, desconto, gorjeta e formas de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-white/60">Serviço</Label>
              <Input type="number" step="0.01" min={0} value={service}
                onChange={(e) => setService(Number(e.target.value))}
                className="bg-black border-white/10" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-white/60">Produtos</Label>
              <Input type="number" step="0.01" min={0} value={products}
                onChange={(e) => setProducts(Number(e.target.value))}
                className="bg-black border-white/10" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-white/60">Desconto</Label>
              <Input type="number" step="0.01" min={0} value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="bg-black border-white/10" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-white/60">Gorjeta</Label>
              <Input type="number" step="0.01" min={0} value={tip}
                onChange={(e) => { setTip(Number(e.target.value)); setTipPreset("custom"); }}
                className="bg-black border-[#D4AF37]/40" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[0, 10, 15, 20].map((p) => (
              <Button key={p} type="button" size="sm" variant="outline"
                onClick={() => applyTipPreset(p)}
                className={`h-8 rounded-lg border-white/10 bg-black text-xs ${tipPreset === p ? "border-[#D4AF37] text-[#D4AF37]" : "text-white/70"}`}>
                {p === 0 ? "Sem gorjeta" : `${p}%`}
              </Button>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Subtotal</span><span>{money(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Gorjeta</span><span>{money(tip)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Desconto</span><span>- {money(discount)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-black text-[#D4AF37]">
              <span>Total</span><span>{money(total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-white/60">Formas de pagamento</Label>
            {METHODS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex items-center gap-2 w-32 text-white/80 text-sm">
                  <Icon className="h-4 w-4 text-[#D4AF37]" /> {label}
                </div>
                <Input type="number" step="0.01" min={0} value={breakdown[key]}
                  onChange={(e) => setBreakdown((b) => ({ ...b, [key]: Number(e.target.value) }))}
                  className="bg-black border-white/10 flex-1" />
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => autoFill(key)}
                  className="h-8 text-[10px] uppercase tracking-widest text-[#D4AF37] hover:bg-[#D4AF37]/10">
                  Resto
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Pago: {money(paid)}</span>
            <Badge className={balanced ? "bg-emerald-600" : "bg-amber-600"}>
              {balanced ? "OK" : `Falta ${money(remaining)}`}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
            className="rounded-xl border-white/10 bg-black text-white/70">Cancelar</Button>
          <Button onClick={submit} disabled={loading || !balanced}
            className="rounded-xl bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black uppercase text-[10px] tracking-widest">
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
