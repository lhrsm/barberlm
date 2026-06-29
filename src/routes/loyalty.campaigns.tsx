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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to="/loyalty"
                className="h-10 w-10 rounded-xl border border-zinc-800 grid place-items-center text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center">
                <ListChecks className="h-7 w-7 text-[#f59e0b]" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Minhas Campanhas</h1>
                <p className="text-sm text-zinc-400">Gerencie todas as campanhas de fidelidade ativas e em rascunho.</p>
              </div>
            </div>
            <Button
              asChild
              className="h-11 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black font-bold"
            >
              <Link to="/loyalty/templates">
                <Plus className="h-4 w-4 mr-2" /> Nova campanha
              </Link>
            </Button>
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
                    className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 hover:border-[#f59e0b]/30 transition-all"
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
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(c)} className="border-zinc-800 text-zinc-300 hover:text-white">
                        {c.status === "active" ? <><Pause className="h-3.5 w-3.5 mr-1.5" />Pausar</> : <><Play className="h-3.5 w-3.5 mr-1.5" />Ativar</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate({ to: "/loyalty/campaigns/$id", params: { id: c.id } })} className="border-zinc-800 text-zinc-300 hover:text-white">
                        <Edit className="h-3.5 w-3.5 mr-1.5" />Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => duplicate(c)} className="border-zinc-800 text-zinc-300 hover:text-white">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(c)} className="border-zinc-800 text-red-400 hover:text-red-300 hover:border-red-500/40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
