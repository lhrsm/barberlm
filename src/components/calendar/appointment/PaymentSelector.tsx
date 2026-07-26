import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "./appointment-utils";
import { cn } from "@/lib/utils";

export const PAYMENT_STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "partial", label: "Parcial" },
  { value: "exempt", label: "Isento" },
  { value: "courtesy", label: "Cortesia" },
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "credits", label: "Crédito do cliente" },
  { value: "cashback", label: "Cashback" },
  { value: "mixed", label: "Pagamento misto" },
  { value: "later", label: "Pagar depois" },
];

interface Props {
  status: string;
  method: string;
  onStatusChange: (v: string) => void;
  onMethodChange: (v: string) => void;
  mixedCredits: string;
  mixedOther: string;
  onMixedCreditsChange: (v: string) => void;
  onMixedOtherChange: (v: string) => void;
  total: number;
  methodError?: string | null;
  mixedError?: string | null;
}

export function PaymentSelector({
  status,
  method,
  onStatusChange,
  onMethodChange,
  mixedCredits,
  mixedOther,
  onMixedCreditsChange,
  onMixedOtherChange,
  total,
  methodError,
  mixedError,
}: Props) {
  const sum = Number(mixedCredits || 0) + Number(mixedOther || 0);
  const matches = Math.abs(sum - total) < 0.01;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Pagamento">
      <h3 className="mb-3 text-sm font-black text-foreground">Pagamento</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payment-status" className="text-xs font-semibold text-muted-foreground">
            Status do pagamento
          </Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger id="payment-status" className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-method" className="text-xs font-semibold text-muted-foreground">
            Forma de pagamento
          </Label>
          <Select value={method} onValueChange={onMethodChange}>
            <SelectTrigger
              id="payment-method"
              className={cn("rounded-xl", methodError && "border-destructive")}
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {methodError && <p className="text-xs font-medium text-destructive">{methodError}</p>}
        </div>
      </div>

      {method === "mixed" && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mixed-credits" className="text-xs font-semibold text-muted-foreground">
                Créditos
              </Label>
              <Input
                id="mixed-credits"
                type="number"
                step="0.01"
                min="0"
                value={mixedCredits}
                onChange={(e) => onMixedCreditsChange(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mixed-other" className="text-xs font-semibold text-muted-foreground">
                Demais formas
              </Label>
              <Input
                id="mixed-other"
                type="number"
                step="0.01"
                min="0"
                value={mixedOther}
                onChange={(e) => onMixedOtherChange(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <p
            className={cn(
              "text-xs font-bold",
              matches ? "text-emerald-600" : "text-destructive",
            )}
          >
            Soma: {formatBRL(sum)} / Total: {formatBRL(total)}
          </p>
          {mixedError && <p className="text-xs font-medium text-destructive">{mixedError}</p>}
        </div>
      )}
    </section>
  );
}
