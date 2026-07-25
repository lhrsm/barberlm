import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Loader2,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import { getStripeEnvironment } from "@/lib/stripe";
import {
  computeProjectedTotals,
  findBestUpgradeOption,
  type BillingCycle,
} from "@/lib/addons-engine.functions";
import {
  previewAddonsBatch,
  subscribeToAddonsBatch,
} from "@/utils/addons.functions";

export type CartAddon = {
  id: string;
  addon_key: string;
  name: string;
  monthly_price: number;
  annual_price?: number | null;
  module_key: string;
};

export type CartLine = {
  addon: CartAddon;
  quantity: number;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lines: CartLine[];
  cycle: BillingCycle;
  onCycleChange: (c: BillingCycle) => void;
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
  onClear: () => void;
  onCheckoutSuccess?: () => void;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function AddonsCartDrawer({
  open,
  onOpenChange,
  lines,
  cycle,
  onCycleChange,
  onRemove,
  onQuantityChange,
  onClear,
  onCheckoutSuccess,
}: Props) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const env = (() => {
    try { return getStripeEnvironment(); } catch { return "sandbox" as const; }
  })();

  const cart = useMemo(
    () => lines.map((l) => ({
      addon_id: l.addon.id,
      quantity: l.quantity,
      billing_cycle: cycle,
    })),
    [lines, cycle],
  );

  const localMonthlySubtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.addon.monthly_price ?? 0) * l.quantity, 0),
    [lines],
  );
  const localAnnualSubtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.addon.annual_price ?? l.addon.monthly_price * 12) * l.quantity, 0),
    [lines],
  );

  const projected = useQuery({
    queryKey: ["addon-cart-projected", cart, cycle],
    queryFn: async () => {
      const r = await computeProjectedTotals({ data: { cart, cycle } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    enabled: open && cart.length > 0,
    staleTime: 20_000,
  });

  const upgrade = useQuery({
    queryKey: ["addon-cart-upgrade", cart],
    queryFn: async () => {
      const r = await findBestUpgradeOption({ data: { cart } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    enabled: open && cart.length > 0,
    staleTime: 30_000,
  });

  const preview = useQuery({
    queryKey: ["addon-cart-preview", cart, env],
    queryFn: async () => {
      const r = await previewAddonsBatch({
        data: {
          items: cart.map((c) => ({
            addonId: c.addon_id,
            quantity: c.quantity,
            billingCycle: cycle,
          })),
          environment: env,
        },
      });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    enabled: open && cart.length > 0,
    staleTime: 20_000,
  });

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const r = await subscribeToAddonsBatch({
        data: {
          items: cart.map((c) => ({
            addonId: c.addon_id,
            quantity: c.quantity,
            billingCycle: cycle,
          })),
          environment: env,
        },
      });
      if (!r.ok) throw new Error(r.error);
      toast.success(
        r.contracts.length > 1
          ? `${r.contracts.length} módulos contratados com sucesso!`
          : "Módulo contratado com sucesso!",
      );
      qc.invalidateQueries({ queryKey: ["tenant-addons"] });
      qc.invalidateQueries({ queryKey: ["my-addons"] });
      qc.invalidateQueries({ queryKey: ["module-access"] });
      onClear();
      onOpenChange(false);
      onCheckoutSuccess?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao finalizar contratação");
    } finally {
      setSubmitting(false);
    }
  };

  const rec = upgrade.data;
  const isRecommended = rec?.recommended && rec.target_plan;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#050810] border-l border-white/10 text-white w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-300" />
            Carrinho de módulos
          </SheetTitle>
          <SheetDescription className="text-white/60">
            Revise sua seleção, escolha o ciclo e confirme.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Ciclo */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
              Ciclo de cobrança
            </div>
            <ToggleGroup
              type="single"
              value={cycle}
              onValueChange={(v) => v && onCycleChange(v as BillingCycle)}
              className="grid grid-cols-2 gap-2"
            >
              <ToggleGroupItem
                value="monthly"
                className="data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-200 data-[state=on]:border-amber-500/40 border border-white/10 text-white/70 text-xs"
              >
                Mensal · {brl(localMonthlySubtotal)}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="annual"
                className="data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-200 data-[state=on]:border-amber-500/40 border border-white/10 text-white/70 text-xs"
              >
                Anual · {brl(localAnnualSubtotal)}
              </ToggleGroupItem>
            </ToggleGroup>
            {cycle === "annual" && localAnnualSubtotal < localMonthlySubtotal * 12 && (
              <p className="text-[11px] text-emerald-300 mt-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Economia de {brl(localMonthlySubtotal * 12 - localAnnualSubtotal)} no anual
              </p>
            )}
          </div>

          {/* Linhas */}
          {lines.length === 0 ? (
            <div className="text-center py-10 text-white/50 text-sm">
              Nenhum módulo selecionado.
            </div>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => {
                const price = cycle === "annual"
                  ? Number(l.addon.annual_price ?? l.addon.monthly_price * 12)
                  : Number(l.addon.monthly_price);
                return (
                  <li
                    key={l.addon.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white truncate">{l.addon.name}</div>
                        <div className="text-[11px] text-white/50">
                          {brl(price)} × {l.quantity} = <span className="text-emerald-300 font-semibold">{brl(price * l.quantity)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(l.addon.id)}
                        className="text-white/40 hover:text-red-300 shrink-0"
                        aria-label="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-white/10 bg-white/[0.03] hover:bg-white/10"
                        onClick={() => onQuantityChange(l.addon.id, Math.max(1, l.quantity - 1))}
                        disabled={l.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm text-white">{l.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-white/10 bg-white/[0.03] hover:bg-white/10"
                        onClick={() => onQuantityChange(l.addon.id, l.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Recomendação de upgrade */}
          {isRecommended && rec?.target_plan && (
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.05] to-transparent p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Recomendação inteligente
                  </div>
                  <div className="font-bold text-white text-sm">
                    Plano {rec.target_plan.name} sai mais em conta
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="rounded-lg bg-black/30 p-2 border border-white/5">
                  <div className="text-white/40 text-[10px]">Carrinho atual</div>
                  <div className="text-white font-bold">{brl(rec.cart_total_monthly)}/mês</div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/25">
                  <div className="text-emerald-200 text-[10px]">Com {rec.target_plan.name}</div>
                  <div className="text-emerald-300 font-bold">{brl(rec.target_total_monthly)}/mês</div>
                </div>
              </div>
              {rec.monthly_savings > 0 && (
                <div className="text-xs text-emerald-200 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Economia de <strong>{brl(rec.monthly_savings)}/mês</strong>
                </div>
              )}
              {rec.modules_included_by_target.length > 0 && (
                <p className="text-[11px] text-white/60 mb-3">
                  Inclui {rec.modules_included_by_target.length} módulo(s) do seu carrinho sem custo extra.
                </p>
              )}
              <Link to="/subscription">
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
                >
                  Ver plano {rec.target_plan.name}
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          )}

          {/* Preview de cobrança */}
          {cart.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1">
                Cobrança
              </div>
              {preview.isLoading ? (
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Calculando proporcional...
                </div>
              ) : preview.error ? (
                <div className="text-xs text-amber-200 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{(preview.error as Error).message}</span>
                </div>
              ) : preview.data && preview.data.ok ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Cobrança proporcional agora</span>
                    <span className="font-bold text-white">
                      {brl(Math.max(0, preview.data.prorationAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Próxima fatura</span>
                    <span className="font-bold text-emerald-400">
                      {brl(preview.data.nextInvoiceAmount)}
                    </span>
                  </div>
                  {preview.data.nextInvoiceDate && (
                    <div className="flex justify-between text-[11px] text-white/40 pt-2 border-t border-white/5">
                      <span>Data</span>
                      <span>{new Date(preview.data.nextInvoiceDate).toLocaleDateString("pt-BR")}</span>
                    </div>
                  )}
                </>
              ) : null}

              {projected.data && "total" in projected.data && (
                <div className="pt-2 mt-1 border-t border-white/5 flex justify-between text-xs text-white/50">
                  <span>Total projetado ({cycle === "annual" ? "ano" : "mês"})</span>
                  <span className="font-semibold text-white/80">{brl(projected.data.total)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-white/60 text-[10px]">
              {lines.length} {lines.length === 1 ? "módulo" : "módulos"}
            </Badge>
            {lines.length > 0 && (
              <button
                className="text-[11px] text-white/40 hover:text-white/70"
                onClick={onClear}
              >
                Limpar carrinho
              </button>
            )}
          </div>
        </div>

        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold h-11"
            disabled={submitting || lines.length === 0}
            onClick={handleCheckout}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
            ) : (
              <>Confirmar contratação · {brl(localMonthlySubtotal)}/{cycle === "annual" ? "mês equivalente" : "mês"}</>
            )}
          </Button>
          <Button variant="outline" className="w-full border-white/10 bg-white/[0.03]" onClick={() => onOpenChange(false)}>
            Continuar comprando
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
