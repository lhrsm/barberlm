import { useState } from "react";
import { Ticket, Infinity as InfinityIcon, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingContext } from "@/lib/billing-context.functions";
import { BenefitDetailsModal } from "./BenefitDetailsModal";

interface Props {
  ctx: BillingContext;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

/**
 * Card principal exibido no lugar de "Assinatura ativa" para tenants
 * com voucher administrativo permanente.
 */
export function BenefitCard({ ctx }: Props) {
  const [open, setOpen] = useState(false);
  const v = ctx.voucher;
  const permanent = v?.duration_type === "forever";

  return (
    <>
      <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#0b0f17] p-5 md:p-6 shadow-[0_8px_28px_rgba(212,175,55,0.12)]">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-5 mb-5 border-b border-zinc-800/80">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 grid place-items-center shrink-0">
              <Ticket className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                Benefício administrativo
              </div>
              <h2 className="text-xl font-black text-white leading-tight">
                Plano {ctx.plan_name ?? "Elite"} — voucher permanente
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Concedido pelo Super Admin do Barbex · Ambiente interno de testes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Badge tone="gold" icon={ShieldCheck} label="Voucher administrativo" />
            <Badge tone="violet" icon={Sparkles} label="Ambiente interno" />
            <Badge tone="emerald" icon={InfinityIcon} label="Isento" />
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Row label="Mensalidade original" value={brl(ctx.original_monthly_amount)} />
          <Row label="Add-ons" value={brl(ctx.addons_monthly_amount)} />
          <Row
            label="Benefício administrativo"
            value={`- ${brl(ctx.discount_amount)}`}
            highlight="gold"
          />
          <Row
            label="Total atual"
            value={brl(ctx.final_monthly_amount)}
            highlight={ctx.final_monthly_amount === 0 ? "emerald" : undefined}
            bold
          />
        </div>

        {/* Meta */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <Meta label="Validade" value={permanent ? "Permanente" : "Até revogação"} />
          <Meta
            label="Método de pagamento"
            value={ctx.requires_payment_method ? "Obrigatório" : "Não obrigatório"}
          />
          <Meta
            label="Assinatura Stripe"
            value={ctx.stripe_subscription_status ?? "—"}
            muted
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-zinc-500">
            Este benefício é gerenciado exclusivamente pelo Super Admin.
          </p>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-[#0b0f17] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] font-bold text-xs h-9 rounded-lg px-4"
          >
            Visualizar detalhes do benefício
          </Button>
        </div>
      </div>

      <BenefitDetailsModal open={open} onOpenChange={setOpen} ctx={ctx} />
    </>
  );
}

function Row({
  label,
  value,
  highlight,
  bold,
}: {
  label: string;
  value: string;
  highlight?: "gold" | "emerald";
  bold?: boolean;
}) {
  const color =
    highlight === "gold"
      ? "text-[#D4AF37]"
      : highlight === "emerald"
        ? "text-emerald-400"
        : "text-white";
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800/70 bg-[#05070d] px-4 py-3">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`${bold ? "text-lg font-black" : "text-sm font-bold"} ${color}`}>
        {value}
      </span>
    </div>
  );
}

function Meta({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-[#05070d] px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div className={`text-sm font-bold ${muted ? "text-zinc-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

function Badge({
  tone,
  icon: Icon,
  label,
}: {
  tone: "gold" | "violet" | "emerald";
  icon: any;
  label: string;
}) {
  const map = {
    gold: "bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]",
    violet: "bg-violet-500/10 border-violet-500/30 text-violet-300",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${map[tone]}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
