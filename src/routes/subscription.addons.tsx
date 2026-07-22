import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModules } from "@/hooks/use-modules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Check, Package, Sparkles, ShoppingBag, CreditCard, Wallet, Trophy, Ticket, TrendingUp, BarChart3, Percent, Zap, Infinity as InfinityIcon, Code, Plug, Palette, LucideIcon } from "lucide-react";
import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";
import { SubscribeAddonDialog } from "@/components/subscription/SubscribeAddonDialog";

export const Route = createFileRoute("/subscription/addons")({
  component: AddonsCatalog,
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
  head: () => ({
    meta: [
      { title: "Módulos Adicionais | Barbex" },
      { name: "description", content: "Personalize sua assinatura Barbex adicionando apenas os módulos que sua barbearia precisa." },
    ],
  }),
});

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag, Package, CreditCard, Wallet, Trophy, Ticket, TrendingUp, BarChart3, Percent, Zap, Infinity: InfinityIcon, Sparkles, Code, Plug, Palette,
};

const CATEGORY_LABELS: Record<string, string> = {
  gestao: "Gestão",
  financeiro: "Financeiro",
  vendas: "Vendas",
  relacionamento: "Relacionamento",
  automacao: "Automação",
  ia: "Inteligência Artificial",
  integracoes: "Integrações",
};

interface Addon {
  id: string;
  addon_key: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  module_key: string;
  monthly_price: number;
  minimum_plan: string | null;
  benefits: string[];
  max_quantity: number;
  sort_order: number;
}

function AddonsCatalog() {
  const { plan, activeAddons, addonsUsedCount, addonsLimit, canAddMoreAddons, isAllowed } = useModules();
  const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null);

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ["public-addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_addons" as any)
        .select("id, addon_key, name, description, category, icon, module_key, monthly_price, minimum_plan, benefits, max_quantity, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as Addon[]) || [];
    },
  });

  const contractedIds = new Set(activeAddons.map((a) => a.addon_id));
  const grouped = addons.reduce<Record<string, Addon[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const totalAddonsCost = activeAddons.reduce((s, a) => s + a.unit_price * a.quantity, 0);
  const totalMonthly = (plan?.price_monthly ?? 0) + totalAddonsCost;

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 uppercase tracking-wider mb-3">
            Módulos Adicionais
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Personalize sua <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">assinatura Barbex</span>
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-sm md:text-base">
            Adicione apenas os recursos que sua barbearia precisa, sem migrar de plano.
          </p>
        </div>

        {/* Resumo do plano */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0A1020] to-[#0B1426] p-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Seu plano</div>
              <div className="text-lg font-bold text-white mt-1">{plan?.name ?? "—"}</div>
              <div className="text-xs text-white/40">R$ {(plan?.price_monthly ?? 0).toFixed(2)}/mês</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Add-ons ativos</div>
              <div className="text-lg font-bold text-white mt-1">{addonsUsedCount} / {addonsLimit}</div>
              <div className="text-xs text-white/40">{canAddMoreAddons ? "Você pode contratar mais" : "Limite atingido"}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Custo add-ons</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">R$ {totalAddonsCost.toFixed(2)}</div>
              <div className="text-xs text-white/40">por mês</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Mensalidade total</div>
              <div className="text-lg font-bold text-amber-300 mt-1">R$ {totalMonthly.toFixed(2)}</div>
              <Link to="/subscription" className="text-xs text-amber-400 hover:underline">Ver planos →</Link>
            </div>
          </div>
        </div>

        {isLoading && <div className="text-center text-white/50 py-10">Carregando catálogo...</div>}

        {/* Cards por categoria */}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-10">
            <h2 className="text-lg font-bold text-white/80 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-amber-500/40" />
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((a) => {
                const Icon = ICON_MAP[a.icon ?? "Package"] ?? Package;
                const isContracted = contractedIds.has(a.id);
                const isInPlan = isAllowed(a.module_key) && !isContracted;
                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl border p-5 flex flex-col ${
                      isContracted
                        ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] to-transparent"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                        isContracted ? "bg-emerald-500/15 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/25"
                      }`}>
                        <Icon className={`w-5 h-5 ${isContracted ? "text-emerald-300" : "text-amber-300"}`} />
                      </div>
                      {isContracted && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                          Ativo
                        </Badge>
                      )}
                      {isInPlan && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">
                          Incluído no plano
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-base">{a.name}</h3>
                    <p className="text-xs text-white/60 mt-1 mb-3 min-h-[32px]">{a.description}</p>

                    {Array.isArray(a.benefits) && a.benefits.length > 0 && (
                      <ul className="space-y-1.5 mb-4">
                        {a.benefits.slice(0, 3).map((b, i) => (
                          <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto flex items-end justify-between pt-3 border-t border-white/10">
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">a partir de</div>
                        <div className="text-xl font-bold text-white">
                          R$ {Number(a.monthly_price).toFixed(2)}
                          <span className="text-xs text-white/50 font-normal">/mês</span>
                        </div>
                      </div>
                      {isInPlan ? (
                        <Link to="/settings">
                          <Button size="sm" variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20">
                            Ativar
                          </Button>
                        </Link>
                      ) : isContracted ? (
                        <Link to="/subscription">
                          <Button size="sm" variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
                            Gerenciar
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setSelectedAddon(a)}
                          disabled={!canAddMoreAddons}
                          title={!canAddMoreAddons ? "Limite de add-ons do seu plano atingido" : undefined}
                          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold disabled:opacity-50"
                        >
                          Contratar
                          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Upgrade hint */}
        {totalAddonsCost > 0 && (
          <div className="mt-10 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">Dica de economia</h3>
            <p className="text-sm text-white/70 mb-4">
              Se você contratar muitos módulos avulsos, pode ser mais barato migrar para um plano superior.
              Compare com o Plano Pro e veja se vale o upgrade.
            </p>
            <Link to="/subscription">
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold">
                Comparar planos
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
