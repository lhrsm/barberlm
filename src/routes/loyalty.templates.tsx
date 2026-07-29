import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { withModule } from "@/components/modules/withModule";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Search, Layers, Loader2, ArrowLeft, LayoutDashboard, ListChecks } from "lucide-react";
import { TemplateCard } from "@/components/loyalty/TemplateCard";
import { TemplatePreviewModal } from "@/components/loyalty/TemplatePreviewModal";
import { useServerFn } from "@tanstack/react-start";
import { suggestLoyaltyCampaigns } from "@/lib/loyalty-premium.functions";

export const Route = createFileRoute("/loyalty/templates")({
  component: withModule("loyalty", "Templates de Fidelidade", TemplatesPage),
});

const CATEGORIES = [
  { id: "all", label: "Mais utilizadas" },
  { id: "crescimento", label: "Crescimento" },
  { id: "recorrencia", label: "Recorrência" },
  { id: "cashback", label: "Cashback" },
  { id: "assinaturas", label: "Assinaturas" },
  { id: "datas", label: "Datas comemorativas" },
  { id: "personalizadas", label: "Personalizadas" },
];

const mkTpl = (
  slug: string,
  name: string,
  description: string,
  category: string,
  icon: string,
  color: string,
  benefits: string[],
  rule_type = "visits",
  difficulty: "easy" | "medium" | "advanced" = "easy",
  is_featured = false,
) => ({
  id: `fallback-${slug}`,
  slug,
  name,
  description,
  category,
  icon,
  color,
  benefits,
  difficulty,
  is_featured,
  default_config: { rule_type, reward: { type: "discount" } },
});

const FALLBACK_TEMPLATES = [
  mkTpl("clube-dos-10", "Clube dos 10", "A cada 10 atendimentos, 1 corte grátis.", "recorrencia", "Trophy", "#f59e0b", ["Aumenta recorrência", "Mecânica simples", "Cliente sabe a meta"], "visits", "easy", true),
  mkTpl("cashback-progressivo", "Cashback Progressivo", "Devolução escalonada conforme gasto mensal.", "cashback", "PiggyBank", "#10b981", ["Eleva ticket médio", "Premia gasto maior", "Crédito reutilizável"], "spend", "medium", true),
  mkTpl("cliente-ouro", "Cliente Ouro", "Status premium após 20 visitas com benefícios exclusivos.", "recorrencia", "Crown", "#eab308", ["Status VIP", "Atendimento prioritário", "Brindes mensais"], "visits", "medium"),
  mkTpl("aniversariante-premium", "Aniversariante Premium", "Brinde + 30% off no mês do aniversário.", "datas", "Cake", "#ec4899", ["Engajamento sazonal", "Lembrança automática", "Conversão alta"], "birthday", "easy"),
  mkTpl("indique-um-amigo", "Indique um Amigo", "Cliente e amigo ganham crédito ao concluir 1 serviço.", "crescimento", "Users", "#3b82f6", ["Crescimento orgânico", "CAC zero", "Premiação dupla"], "referral", "easy", true),
  mkTpl("cliente-vip", "Cliente VIP", "Acesso a horários exclusivos e produtos premium.", "recorrencia", "Star", "#a855f7", ["Exclusividade real", "Fideliza topo de base", "Diferencial competitivo"], "tier", "advanced"),
  mkTpl("desafio-mensal", "Desafio Mensal", "Quem atingir X atendimentos no mês ganha bônus.", "recorrencia", "Target", "#f97316", ["Gera urgência", "Mecânica gamificada", "Renova todo mês"], "monthly_goal", "medium"),
  mkTpl("clube-da-barba", "Clube da Barba", "A cada 5 barbas, 1 grátis ou tratamento exclusivo.", "recorrencia", "Scissors", "#84cc16", ["Foco em serviço específico", "Aumenta frequência da barba"], "visits", "easy"),
  mkTpl("clube-do-cabelo", "Clube do Cabelo", "A cada 6 cortes, 1 corte premium grátis.", "recorrencia", "Scissors", "#06b6d4", ["Recorrência no carro-chefe", "Meta clara"], "visits", "easy"),
  mkTpl("combo-premiado", "Combo Premiado", "Levou corte + barba? Ganha pontos extras.", "recorrencia", "Gift", "#f59e0b", ["Aumenta ticket por visita", "Estimula combo"], "combo", "easy"),
  mkTpl("cliente-frequente", "Cliente Frequente", "3 visitas em 60 dias = desconto na próxima.", "recorrencia", "Repeat", "#22c55e", ["Reduz intervalo", "Premia constância"], "frequency", "medium"),
  mkTpl("cliente-sem-falta", "Cliente Sem Falta", "Zero faltas em 3 meses = brinde.", "recorrencia", "ShieldCheck", "#0ea5e9", ["Reduz no-show", "Premia compromisso"], "no_show", "medium"),
  mkTpl("assinante-premium-3", "Assinante Premium 3 Meses", "3 meses de assinatura = brinde exclusivo.", "assinaturas", "BadgeCheck", "#D4AF37", ["Reduz cancelamento", "Premia constância do plano"], "subscription_tenure", "easy"),
  mkTpl("assinante-premium-6", "Assinante Premium 6 Meses", "6 meses de assinatura = upgrade + brinde.", "assinaturas", "BadgeCheck", "#D4AF37", ["Marca milestone", "Aumenta LTV"], "subscription_tenure", "medium"),
  mkTpl("assinante-premium-12", "Assinante Premium 12 Meses", "1 ano = mês grátis + kit premium.", "assinaturas", "Crown", "#D4AF37", ["Retenção anual", "Diferencial forte"], "subscription_tenure", "advanced", true),
  mkTpl("assinante-indica", "Assinante Indica", "Assinante que indica outro assinante ganha bônus.", "assinaturas", "Users", "#a855f7", ["Crescimento da base premium", "Recompensa dupla"], "referral", "medium"),
  mkTpl("compra-de-produtos", "Compra de Produtos", "A cada R$ X em produtos, ganhe crédito.", "cashback", "ShoppingBag", "#f97316", ["Gira estoque", "Aumenta venda cruzada"], "product_spend", "easy"),
  mkTpl("black-friday", "Black Friday", "Pontos em dobro durante a campanha.", "datas", "Tag", "#ef4444", ["Pico sazonal", "Cria urgência"], "seasonal", "easy"),
  mkTpl("natal", "Natal", "Brinde de Natal para clientes frequentes.", "datas", "Gift", "#dc2626", ["Lembrança afetiva", "Reativa base"], "seasonal", "easy"),
  mkTpl("fidelidade-personalizada", "Fidelidade Personalizada", "Crie suas próprias regras do zero.", "personalizadas", "Settings", "#64748b", ["Total flexibilidade", "Adapte ao seu negócio"], "custom", "advanced"),
];

function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [preview, setPreview] = useState<any | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [premiumEnabled, setPremiumEnabled] = useState<boolean | null>(null);
  const suggestFn = useServerFn(suggestLoyaltyCampaigns);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [tplRes, settingsRes] = await Promise.all([
          supabase.from("loyalty_campaign_templates" as any).select("*").order("sort_order"),
          user
            ? supabase.from("loyalty_settings" as any).select("premium_enabled").eq("tenant_id", user.id).maybeSingle()
            : Promise.resolve({ data: null } as any),
        ]);
        if (cancelled) return;
        const rows = ((tplRes as any)?.data as any[]) || [];
        setTemplates(rows.length ? rows : FALLBACK_TEMPLATES);
        setPremiumEnabled(((settingsRes as any)?.data?.premium_enabled as boolean) ?? true);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[loyalty/templates] load error", e);
        setLoadError(e?.message || "Erro ao carregar templates");
        setTemplates(FALLBACK_TEMPLATES);
        setPremiumEnabled(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (search && !`${t.name} ${t.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [templates, category, search]);

  async function handleUseTemplate(tpl: any) {
    if (!user) return;
    const cfg = tpl.default_config || {};
    const { data, error } = await supabase
      .from("loyalty_campaigns" as any)
      .insert({
        tenant_id: user.id,
        template_slug: tpl.slug,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        status: "draft",
        rule_type: cfg.rule_type || "custom",
        config: cfg,
        reward: cfg.reward || {},
        icon: tpl.icon,
        color: tpl.color,
        message_template: `Parabéns {{cliente_nome}}! Você desbloqueou: ${tpl.name}`,
      } as any)
      .select("id")
      .single();
    if (error) {
      toast.error("Erro ao criar campanha: " + error.message);
      return;
    }
    toast.success("Campanha criada como rascunho!");
    navigate({ to: "/loyalty/campaigns/$id", params: { id: (data as any).id } });
  }

  async function handleAiSuggest() {
    setAiOpen(true);
    setAiLoading(true);
    try {
      const res: any = await (suggestFn as any)();
      setAiSuggestions(res?.suggestions || []);
    } catch (e: any) {
      toast.error("Erro IA: " + (e?.message || e));
    } finally {
      setAiLoading(false);
    }
  }

  if (premiumEnabled === false) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#05070d] text-white grid place-items-center p-6">
          <div className="max-w-md w-full bg-gradient-to-b from-[#0b0f17] to-[#05070d] border border-gold/30 rounded-2xl p-8 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/40 grid place-items-center">
              <Sparkles className="h-8 w-8 text-gold" />
            </div>
            <h2 className="text-2xl font-black">Fidelidade Premium desativada</h2>
            <p className="text-sm text-zinc-400">
              Ative a Fidelidade Premium em Configurações para usar templates e campanhas avançadas.
            </p>
            <Button
              onClick={() => navigate({ to: "/settings" })}
              className="w-full h-11 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-wider"
            >
              Ir para Configurações
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to="/loyalty"
                className="h-10 w-10 rounded-xl border border-zinc-800 grid place-items-center text-zinc-400 hover:text-white hover:border-[#f59e0b]/40"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center">
                <Layers className="h-7 w-7 text-[#f59e0b]" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">Biblioteca de Templates</h1>
                <p className="text-sm text-zinc-400">Modelos prontos de fidelidade. Use, edite e ative em segundos.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-2.5 md:justify-end md:flex-wrap overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link
                to="/loyalty/campaigns"
                className="shrink-0 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[12px] text-[13px] font-bold text-white bg-white/[0.03] border border-[#f5c542]/30 hover:bg-[#f5c542]/10 hover:border-[#f5c542]/65 hover:shadow-[0_8px_22px_rgba(245,197,66,0.16)] hover:-translate-y-px transition-all whitespace-nowrap md:min-w-[150px] md:max-w-[190px]"
              >
                <ListChecks className="h-4 w-4 text-[#f5c542]" /> Minhas campanhas
              </Link>
              <Link
                to="/loyalty/dashboard"
                className="shrink-0 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[12px] text-[13px] font-bold text-white bg-white/[0.03] border border-[#f5c542]/30 hover:bg-[#f5c542]/10 hover:border-[#f5c542]/65 hover:shadow-[0_8px_22px_rgba(245,197,66,0.16)] hover:-translate-y-px transition-all whitespace-nowrap md:min-w-[150px] md:max-w-[190px]"
              >
                <LayoutDashboard className="h-4 w-4 text-[#f5c542]" /> Dashboard
              </Link>
              <button
                onClick={handleAiSuggest}
                className="shrink-0 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[12px] text-[13px] font-extrabold text-white bg-gradient-to-r from-[#a855f7] to-[#ec4899] hover:from-[#c084fc] hover:to-[#f472b6] shadow-[0_4px_16px_rgba(168,85,247,0.35)] hover:shadow-[0_0_22px_rgba(168,85,247,0.55)] hover:-translate-y-px transition-all whitespace-nowrap md:min-w-[150px] md:max-w-[190px]"
              >
                <Sparkles className="h-4 w-4" /> Sugerir com IA
              </button>
            </div>
          </div>

          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-[#0b0f17] border-zinc-800 focus-visible:border-[#f59e0b]/40"
            />
          </div>

          {/* CATEGORIES */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`shrink-0 h-9 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  category === c.id
                    ? "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
                    : "bg-[#0b0f17] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* GRID */}
          {loading ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-[#f59e0b]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  onPreview={() => setPreview(tpl)}
                  onUse={() => handleUseTemplate(tpl)}
                />
              ))}
            </div>
          )}

          <TemplatePreviewModal
            template={preview}
            open={!!preview}
            onOpenChange={(o) => !o && setPreview(null)}
            onUse={() => {
              if (preview) handleUseTemplate(preview);
              setPreview(null);
            }}
          />

          {/* AI MODAL */}
          {aiOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur z-50 grid place-items-center p-4" onClick={() => setAiOpen(false)}>
              <div className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#a855f7] to-[#ec4899] grid place-items-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Sugestões da IA</h3>
                    <p className="text-xs text-zinc-400">Baseado nos seus clientes e atendimentos</p>
                  </div>
                </div>
                {aiLoading ? (
                  <div className="py-10 grid place-items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#a855f7]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiSuggestions.map((s, i) => {
                      const tpl = templates.find((t) => t.slug === s.template_slug);
                      if (!tpl) return null;
                      return (
                        <div key={i} className="bg-[#05070d] border border-zinc-800 rounded-xl p-4 flex items-center gap-3 hover:border-[#a855f7]/40">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white">{tpl.name}</p>
                            <p className="text-xs text-zinc-400 mt-1">{s.reason}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setAiOpen(false);
                              handleUseTemplate(tpl);
                            }}
                            className="bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white"
                          >
                            Usar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
