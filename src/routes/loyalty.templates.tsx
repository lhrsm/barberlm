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

  useEffect(() => {
    (async () => {
      const [tplRes, settingsRes] = await Promise.all([
        supabase.from("loyalty_campaign_templates" as any).select("*").order("sort_order"),
        user
          ? supabase.from("loyalty_settings" as any).select("premium_enabled").eq("tenant_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setTemplates((tplRes.data as any) || []);
      setPremiumEnabled(((settingsRes as any)?.data?.premium_enabled as boolean) ?? false);
      setLoading(false);
    })();
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
          <div className="max-w-md w-full bg-gradient-to-b from-[#0b0f17] to-[#05070d] border border-[#D4AF37]/30 rounded-2xl p-8 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/40 grid place-items-center">
              <Sparkles className="h-8 w-8 text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-black">Fidelidade Premium desativada</h2>
            <p className="text-sm text-zinc-400">
              Ative a Fidelidade Premium em Configurações para usar templates e campanhas avançadas.
            </p>
            <Button
              onClick={() => navigate({ to: "/settings" })}
              className="w-full h-11 rounded-xl bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-black uppercase tracking-wider"
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
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl border-zinc-800 text-zinc-300 hover:text-white hover:border-[#f59e0b]/40"
              >
                <Link to="/loyalty/campaigns">
                  <ListChecks className="h-4 w-4 mr-2" /> Minhas campanhas
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl border-zinc-800 text-zinc-300 hover:text-white hover:border-[#f59e0b]/40"
              >
                <Link to="/loyalty/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                </Link>
              </Button>
              <Button
                onClick={handleAiSuggest}
                className="h-11 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#ec4899] hover:from-[#c084fc] hover:to-[#f472b6] text-white font-bold shadow-[0_4px_16px_rgba(168,85,247,0.35)]"
              >
                <Sparkles className="h-4 w-4 mr-2" /> Sugerir com IA
              </Button>
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
