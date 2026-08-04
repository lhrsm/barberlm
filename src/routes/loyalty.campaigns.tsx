import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { withModule } from "@/components/modules/withModule";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, Layers, Pause, Play, Copy, Trash2, Edit, ListChecks } from "lucide-react";

export const Route = createFileRoute("/loyalty/campaigns")({
  component: withModule("loyalty", "Campanhas de Fidelidade", CampaignsPage),
});

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativa", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  paused: { label: "Pausada", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  draft: { label: "Rascunho", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  expired: { label: "Expirada", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function CampaignsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from("loyalty_campaigns" as any)
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns((data as any) || []);
    } catch (e: any) {
      console.error("[loyalty/campaigns] load error", e);
      setLoadError(e?.message || "Erro ao carregar campanhas");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [user]);

  async function toggleStatus(c: any) {
    const next = c.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("loyalty_campaigns" as any)
      .update({ status: next })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next === "active" ? "Campanha ativada!" : "Campanha pausada");
      load();
    }
  }

  async function duplicate(c: any) {
    const { error } = await supabase.from("loyalty_campaigns" as any).insert({
      ...c,
      id: undefined,
      name: `${c.name} (cópia)`,
      status: "draft",
      created_at: undefined,
      updated_at: undefined,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Campanha duplicada");
      load();
    }
  }

  async function remove(c: any) {
    if (!confirm(`Excluir "${c.name}"?`)) return;
    const { error } = await supabase.from("loyalty_campaigns" as any).delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Excluída");
      load();
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/loyalty"
                className="h-10 w-10 shrink-0 rounded-xl border border-zinc-800 grid place-items-center text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center">
                <ListChecks className="h-7 w-7 text-[#f59e0b]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-black truncate">Minhas Campanhas</h1>
                <p className="text-sm text-zinc-400">Gerencie todas as campanhas de fidelidade ativas e em rascunho.</p>
              </div>
            </div>
            <Link
              to="/loyalty/templates"
              className="inline-flex items-center justify-center gap-2 w-full md:w-fit md:min-w-[190px] md:max-w-[240px] h-11 px-[22px] rounded-[14px] bg-gradient-to-r from-[#F5C542] to-[#D4A017] text-black font-bold text-sm shadow-[0_8px_24px_-8px_rgba(245,197,66,0.55)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-8px_rgba(245,197,66,0.7)] transition-all duration-200"
            >
              <Plus className="h-4 w-4" /> Nova campanha
            </Link>
          </div>

          {loadError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300 flex items-center justify-between gap-3">
              <span>Não foi possível carregar as campanhas.</span>
              <Button size="sm" variant="outline" onClick={load} className="border-red-500/40 text-red-200 hover:text-white">Tentar novamente</Button>
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-[#f59e0b]" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-[#0b0f17] border-zinc-800">
              <Layers className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
              <h4 className="text-lg font-bold">Nenhuma campanha ainda</h4>
              <p className="text-zinc-400 text-sm max-w-md mx-auto mt-2 mb-4">
                Comece pela biblioteca de templates — escolha um modelo pronto e edite em segundos.
              </p>
              <Button
                asChild
                className="bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black font-bold"
              >
                <Link to="/loyalty/templates">Explorar templates</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {campaigns.map((c) => {
                const s = STATUS_BADGES[c.status] || STATUS_BADGES.draft;
                return (
                  <div
                    key={c.id}
                    className="bg-[#0b0f17] border border-zinc-800 rounded-[20px] p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 hover:border-[#f59e0b]/30 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white truncate">{c.name}</h3>
                        <Badge className={`text-[10px] font-bold border ${s.cls}`}>{s.label}</Badge>
                        {c.category && (
                          <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 capitalize">
                            {c.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-1 mt-1">{c.description}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-2">
                        Tipo: <span className="text-zinc-300">{c.rule_type}</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end md:gap-2 shrink-0">
                      <button
                        onClick={() => toggleStatus(c)}
                        className="inline-flex items-center justify-center gap-1.5 h-[38px] px-[14px] rounded-[10px] text-[13px] font-bold bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505] shadow-[0_4px_14px_-4px_rgba(245,197,66,0.5)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-4px_rgba(245,197,66,0.7)] transition-all duration-200"
                      >
                        {c.status === "active" ? <><Pause className="h-3.5 w-3.5" />Pausar</> : <><Play className="h-3.5 w-3.5" />Ativar</>}
                      </button>
                      <button
                        onClick={() => navigate({ to: "/loyalty/campaigns/$id", params: { id: c.id } } as any)}
                        className="inline-flex items-center justify-center gap-1.5 h-[38px] px-[14px] rounded-[10px] text-[13px] font-bold bg-white/[0.04] border border-[#F5C542]/35 text-white hover:bg-white/[0.08] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-4px_rgba(245,197,66,0.35)] transition-all duration-200"
                      >
                        <Edit className="h-3.5 w-3.5" />Editar
                      </button>
                      <button
                        onClick={() => duplicate(c)}
                        className="inline-flex items-center justify-center gap-1.5 h-[38px] px-[14px] rounded-[10px] text-[13px] font-bold bg-white/[0.04] border border-[#F5C542]/35 text-white hover:bg-white/[0.08] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-4px_rgba(245,197,66,0.35)] transition-all duration-200"
                      >
                        <Copy className="h-3.5 w-3.5" />Duplicar
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="inline-flex items-center justify-center gap-1.5 h-[38px] px-[14px] rounded-[10px] text-[13px] font-bold bg-red-500/10 border border-red-500/35 text-red-400 hover:bg-red-500/15 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-4px_rgba(239,68,68,0.4)] transition-all duration-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
