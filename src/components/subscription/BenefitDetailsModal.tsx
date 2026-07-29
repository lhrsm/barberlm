import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { BillingContext } from "@/lib/billing-context.functions";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: BillingContext;
}

export function BenefitDetailsModal({ open, onOpenChange, ctx }: Props) {
  const v = ctx.voucher;
  const permanent = v?.duration_type === "forever";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0f17] border border-gold/30 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">
            Benefício administrativo do Barbex
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Este benefício é gerenciado exclusivamente pelo Super Admin do Barbex.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          <Field label="Nome do voucher" value={v?.name ?? "—"} />
          <Field label="Finalidade" value={v?.purpose === "internal_testing" ? "Ambiente interno de testes" : v?.purpose ?? "—"} />
          <Field label="Plano liberado" value={ctx.plan_name ?? "—"} />
          <Field label="Add-ons liberados" value={v?.includes_all_addons ? "Todos" : "Personalizado"} />
          <Field label="Desconto" value={`${Number(v?.discount_percentage ?? 0).toFixed(0)}%`} />
          <Field label="Mensalidade original" value={brl(ctx.original_monthly_amount + ctx.addons_monthly_amount)} />
          <Field label="Mensalidade final" value={brl(ctx.final_monthly_amount)} highlight />
          <Field label="Data de início" value={fmtDate(v?.applied_at ?? v?.starts_at ?? null)} />
          <Field label="Validade" value={permanent ? "Permanente" : fmtDate(v?.expires_at ?? null)} />
          <Field label="Status" value="Ativo" />
          <Field label="Método de pagamento" value={ctx.requires_payment_method ? "Obrigatório" : "Não obrigatório"} />
          <Field label="Status técnico Stripe" value={ctx.stripe_subscription_status ?? "—"} muted />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800/70 py-2 last:border-b-0">
      <span className="text-xs text-zinc-400">{label}</span>
      <span
        className={`text-sm font-bold ${
          highlight ? "text-emerald-400" : muted ? "text-zinc-400" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
