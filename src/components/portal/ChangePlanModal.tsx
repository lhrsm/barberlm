import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Crown, Check, Star, Award, Sparkles, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  subscriptionId: string;
  currentPlanId: string;
  onChanged?: () => void;
};

type Plan = any;

const FEATURE_KEYS: { key: string; label: string; map: (p: Plan) => boolean }[] = [
  { key: "portal", label: "Portal Premium", map: () => true },
  { key: "schedule", label: "Agendamento prioritário", map: (p) => !!p.agenda_priority },
  { key: "card", label: "Cartão Digital", map: () => true },
  { key: "loyalty", label: "Fidelidade Premium", map: (p) => !!p.accumulates_premium_loyalty },
  { key: "cashback", label: "Cashback", map: (p) => !!p.participates_cashback },
  { key: "referral", label: "Indicação", map: (p) => Number(p.monthly_price) >= 180 },
  { key: "discount", label: "Desconto Produtos", map: (p) => !!p.allows_product_discount },
  { key: "gifts", label: "Brindes", map: (p) => Number(p.monthly_price) >= 279 },
  { key: "vip_hours", label: "Horário VIP", map: (p) => !!p.exclusive_hours },
  { key: "preferential", label: "Atendimento Prioritário", map: (p) => !!p.preferential_service },
  { key: "elite", label: "Programa Elite", map: (p) => Number(p.monthly_price) >= 399 },
];

function badgeFor(plan: Plan, plans: Plan[]): { label: string; cls: string } | null {
  if (!plans?.length) return null;
  const sorted = [...plans].sort((a, b) => Number(a.monthly_price) - Number(b.monthly_price));
  const top = sorted[sorted.length - 1];
  const mid = sorted[Math.floor(sorted.length / 2)];
  if (plan.id === top.id) return { label: "Exclusivo", cls: "bg-purple-500 text-white" };
  if (sorted.length >= 3 && plan.id === sorted[sorted.length - 2]?.id)
    return { label: "Melhor Custo Benefício", cls: "bg-blue-500 text-white" };
  if (plan.id === mid.id) return { label: "Mais Popular", cls: "bg-[#D4AF37] text-black" };
  return null;
}

export function ChangePlanModal({
  open,
  onOpenChange,
  tenantId,
  subscriptionId,
  currentPlanId,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = React.useState<{ plan: Plan; type: "upgrade" | "downgrade" } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [carouselIdx, setCarouselIdx] = React.useState(0);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["change-plan-options", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("monthly_price", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const currentPlan = plans.find((p) => p.id === currentPlanId);

  const handlePick = (plan: Plan) => {
    if (plan.id === currentPlanId) return;
    const currentPrice = Number(currentPlan?.monthly_price || 0);
    const type: "upgrade" | "downgrade" =
      Number(plan.monthly_price) > currentPrice ? "upgrade" : "downgrade";
    setConfirm({ plan, type });
  };

  const submitChange = async () => {
    if (!confirm) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("request_subscription_plan_change", {
        _subscription_id: subscriptionId,
        _new_plan_id: confirm.plan.id,
      });
      if (error) throw error;
      toast.success(
        confirm.type === "upgrade"
          ? "Upgrade aplicado! Seu novo plano já está ativo."
          : "Solicitação registrada. As novas regras valem na próxima renovação.",
      );
      qc.invalidateQueries();
      onChanged?.();
      setConfirm(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível concluir a mudança.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[96vw] max-w-[1100px] -translate-x-1/2 -translate-y-1/2",
              "rounded-3xl bg-gradient-to-br from-[#0B0B0B] via-[#0F0F0F] to-black border border-[#D4AF37]/30 shadow-[0_20px_60px_-15px_rgba(212,175,55,0.4)]",
              "max-h-[94vh] overflow-hidden flex flex-col",
              "duration-250 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            {/* HEADER */}
            <div className="relative px-6 sm:px-10 pt-8 pb-5 border-b border-white/5">
              <div className="pr-14">
                <DialogPrimitive.Title className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Escolha um plano ideal para você
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-gray-400 mt-2 max-w-2xl">
                  Você pode alterar seu plano a qualquer momento. As alterações entram em vigor na próxima cobrança.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label="Fechar"
                className={cn(
                  "absolute right-5 top-5 h-10 w-10 rounded-full flex items-center justify-center",
                  "bg-[#1A1A1A] border border-[#D4AF37]/50 text-white",
                  "transition-all duration-250",
                  "hover:bg-[#D4AF37] hover:text-black hover:scale-110 hover:border-[#D4AF37]",
                  "focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50",
                )}
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            {/* BODY */}
            <div className="px-6 sm:px-10 py-6 overflow-y-auto space-y-8">
              {isLoading ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando planos...
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-16 text-gray-400">Nenhum plano disponível.</div>
              ) : (
                <>
                  {/* PLAN CARDS */}
                  <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 4)}, minmax(0, 1fr))` }}>
                    {plans.map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        isCurrent={p.id === currentPlanId}
                        badge={badgeFor(p, plans)}
                        onPick={() => handlePick(p)}
                      />
                    ))}
                  </div>

                  {/* MOBILE CAROUSEL */}
                  <div className="md:hidden">
                    <div className="overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2 -mx-2 px-2 scrollbar-thin">
                      {plans.map((p, i) => (
                        <div key={p.id} className="snap-center shrink-0 w-[85%]" onScroll={() => setCarouselIdx(i)}>
                          <PlanCard
                            plan={p}
                            isCurrent={p.id === currentPlanId}
                            badge={badgeFor(p, plans)}
                            onPick={() => handlePick(p)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-1.5 mt-2">
                      {plans.map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            i === carouselIdx ? "w-6 bg-[#D4AF37]" : "w-1.5 bg-white/20",
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* COMPARISON TABLE */}
                  <div>
                    <h3 className="text-base font-black uppercase tracking-widest text-white mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#D4AF37]" /> Comparativo de planos
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left p-3 text-[10px] uppercase tracking-widest font-black text-gray-500">
                              Benefício
                            </th>
                            {plans.map((p) => (
                              <th key={p.id} className="p-3 text-center text-[11px] font-black uppercase tracking-wider text-[#D4AF37]">
                                {p.name.replace(/^Plano\s+/i, "")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {FEATURE_KEYS.map((f) => (
                            <tr key={f.key} className="border-b border-white/5 last:border-0">
                              <td className="p-3 text-gray-300">{f.label}</td>
                              {plans.map((p) => (
                                <td key={p.id} className="p-3 text-center">
                                  {f.map(p) ? (
                                    <Check className="h-4 w-4 text-emerald-400 inline" />
                                  ) : (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* CONFIRMATION */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="bg-[#0A0A0A] border-[#D4AF37]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">
              {confirm?.type === "upgrade" ? "Confirmar upgrade" : "Confirmar downgrade"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {confirm?.type === "upgrade"
                ? "Seu upgrade será aplicado imediatamente e o valor será calculado proporcionalmente ao período restante."
                : "Você realmente deseja fazer downgrade do seu plano? As novas regras entrarão em vigor na próxima renovação."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/15 text-white hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={submitChange}
              className="bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black font-black hover:opacity-90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlanCard({
  plan,
  isCurrent,
  badge,
  onPick,
}: {
  plan: Plan;
  isCurrent: boolean;
  badge: { label: string; cls: string } | null;
  onPick: () => void;
}) {
  const included: string[] = Array.isArray(plan?.included_benefits) ? plan.included_benefits : [];
  const haircuts = plan?.benefits?.haircuts || 0;
  const beards = plan?.benefits?.beards || 0;
  const totalUses = plan?.max_uses_per_month || 0;

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-gradient-to-br from-black via-[#0B0B0B] to-black p-5 flex flex-col",
        "transition-all duration-250",
        isCurrent
          ? "border-emerald-500/50 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)]"
          : "border-white/10 hover:border-[#D4AF37]/60 hover:-translate-y-1 hover:shadow-[0_15px_40px_-15px_rgba(212,175,55,0.45)]",
      )}
    >
      {isCurrent ? (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black font-black text-[10px] uppercase px-3 py-1">
          Plano Atual
        </Badge>
      ) : badge ? (
        <Badge className={cn("absolute -top-3 left-1/2 -translate-x-1/2 font-black text-[10px] uppercase px-3 py-1", badge.cls)}>
          {badge.label}
        </Badge>
      ) : null}

      <div className="text-center pb-4 border-b border-white/10">
        <div className="mx-auto h-10 w-10 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center mb-2">
          <Crown className="h-5 w-5 text-[#D4AF37]" />
        </div>
        <h3 className="text-lg font-black text-white">{plan.name}</h3>
        <p className="text-3xl font-black text-[#D4AF37] mt-2">
          R$ {Number(plan.monthly_price || 0).toFixed(2).replace(".", ",")}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">/ mês</p>
      </div>

      <div className="py-4 space-y-1 text-center text-xs text-gray-300">
        <p className="font-bold text-white">{totalUses || "∞"} utilizações</p>
        {(haircuts > 0 || beards > 0) && (
          <p className="text-gray-400">
            {haircuts} cortes · {beards} barbas
          </p>
        )}
      </div>

      <ul className="space-y-1.5 text-xs flex-1">
        {included.slice(0, 7).map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-gray-200">
            <Check className="h-3.5 w-3.5 text-[#D4AF37] mt-0.5 shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <Button
        disabled={isCurrent}
        onClick={onPick}
        className={cn(
          "mt-5 h-10 rounded-xl font-black transition-all duration-250",
          isCurrent
            ? "bg-white/5 text-gray-500 cursor-not-allowed hover:bg-white/5"
            : "bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black hover:shadow-[0_8px_24px_rgba(212,175,55,0.45)] hover:-translate-y-0.5",
        )}
      >
        {isCurrent ? "Plano Atual" : "Escolher Plano"}
      </Button>
    </div>
  );
}
