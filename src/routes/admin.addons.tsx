import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, TrendingUp, Users, Pencil, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";
import { adminCreateAddonStripePrice } from "@/utils/addons.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/admin/addons")({
  component: AdminAddonsPage,
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
});

interface Addon {
  id: string;
  addon_key: string;
  name: string;
  description: string | null;
  category: string;
  module_key: string;
  monthly_price: number;
  currency: string;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  minimum_plan: string | null;
  max_quantity: number;
  trial_days: number;
  is_active: boolean;
  sort_order: number;
}

const CATEGORIES: Record<string, string> = {
  gestao: "Gestão",
  financeiro: "Financeiro",
  vendas: "Vendas",
  relacionamento: "Relacionamento",
  automacao: "Automação",
  ia: "Inteligência Artificial",
  integracoes: "Integrações",
};

function AdminAddonsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Addon | null>(null);

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ["admin-addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_addons" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as Addon[]) || [];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["admin-addon-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_addons" as any)
        .select("id, tenant_id, addon_id, status, quantity, unit_price, current_period_end, created_at, saas_addons:addon_id(name, addon_key), tenant:tenant_id(is_internal_test_tenant)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (a: Partial<Addon> & { id: string }) => {
      const { error } = await supabase
        .from("saas_addons" as any)
        .update({
          name: a.name,
          description: a.description,
          category: a.category,
          module_key: a.module_key,
          monthly_price: a.monthly_price,
          stripe_price_id_test: a.stripe_price_id_test,
          stripe_price_id_live: a.stripe_price_id_live,
          minimum_plan: a.minimum_plan,
          max_quantity: a.max_quantity,
          trial_days: a.trial_days,
          is_active: a.is_active,
        })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-addons"] });
      toast.success("Add-on atualizado");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("saas_addons" as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-addons"] }),
  });

  const [creatingStripeId, setCreatingStripeId] = useState<string | null>(null);
  const createStripeMut = useMutation({
    mutationFn: async ({ addonId, environment }: { addonId: string; environment: "sandbox" | "live" }) => {
      setCreatingStripeId(addonId);
      const r = await adminCreateAddonStripePrice({ data: { addonId, environment } });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-addons"] });
      toast.success(`Price criado: ${r.priceId}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar no Stripe"),
    onSettled: () => setCreatingStripeId(null),
  });

  const activeContracts = contracts.filter((c) => ["active", "trialing"].includes(c.status));
  // MRR exclui contratos de barbearias internas de teste (voucher administrativo).
  const billableActiveContracts = activeContracts.filter((c) => !c.tenant?.is_internal_test_tenant);
  const mrr = billableActiveContracts.reduce((sum, c) => sum + Number(c.unit_price ?? 0) * (c.quantity ?? 1), 0);
  const topAddonMap: Record<string, number> = {};
  billableActiveContracts.forEach((c) => {
    const name = c.saas_addons?.name ?? "—";
    topAddonMap[name] = (topAddonMap[name] || 0) + 1;
  });
  const topAddon = Object.entries(topAddonMap).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="w-6 h-6 text-purple-400" /> Módulos Adicionais
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Gerencie o catálogo de add-ons vendidos separadamente dos planos.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs text-white/60 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" /> Contratos ativos
          </div>
          <div className="text-2xl font-bold text-white mt-1">{activeContracts.length}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs text-white/60 uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" /> MRR de add-ons
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            R$ {mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs text-white/60 uppercase tracking-wider">
            <Package className="w-3.5 h-3.5" /> Mais contratado
          </div>
          <div className="text-lg font-bold text-white mt-1">{topAddon?.[0] ?? "—"}</div>
          <div className="text-xs text-white/50">{topAddon ? `${topAddon[1]} contratos` : "sem dados"}</div>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="catalog">Catálogo ({addons.length})</TabsTrigger>
          <TabsTrigger value="contracts">Contratos ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/60 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-left px-4 py-3">Module</th>
                  <th className="text-right px-4 py-3">Preço</th>
                  <th className="text-center px-4 py-3">Plano mín.</th>
                  <th className="text-center px-4 py-3">Stripe</th>
                  <th className="text-center px-4 py-3">Ativo</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-white/50">Carregando...</td></tr>
                )}
                {addons.map((a) => (
                  <tr key={a.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{a.name}</div>
                      <div className="text-xs text-white/40">{a.addon_key}</div>
                    </td>
                    <td className="px-4 py-3 text-white/70">{CATEGORIES[a.category] ?? a.category}</td>
                    <td className="px-4 py-3 text-white/60 text-xs font-mono">{a.module_key}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">
                      R$ {Number(a.monthly_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="border-white/20 text-white/70 text-[10px]">
                        {a.minimum_plan ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.stripe_price_id_test || a.stripe_price_id_live ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">OK</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={creatingStripeId === a.id}
                          onClick={() => createStripeMut.mutate({ addonId: a.id, environment: getStripeEnvironment() })}
                          className="relative overflow-hidden h-7 text-[10px] border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:text-[#FFD700] hover:border-[#D4AF37]/60 hover:shadow-[0_0_16px_rgba(212,175,55,0.25)] transition-all duration-300 group"
                        >
                          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent transition-transform duration-700 ease-in-out" />
                          {creatingStripeId === a.id
                            ? <Loader2 className="w-3 h-3 animate-spin relative z-10" />
                            : <><Zap className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform duration-300 relative z-10" /> <span className="relative z-10">Criar no Stripe</span></>}
                        </Button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={a.is_active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: a.id, is_active: v })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="text-white/70 hover:text-white" onClick={() => setEditing(a)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/60 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Barbearia</th>
                  <th className="text-left px-4 py-3">Add-on</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Qtd</th>
                  <th className="text-right px-4 py-3">Preço</th>
                  <th className="text-left px-4 py-3">Fim período</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-white/50">Nenhum contrato ainda.</td></tr>
                )}
                {contracts.map((c: any) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white/70 text-xs font-mono">{String(c.tenant_id).slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-white">{c.saas_addons?.name ?? c.addon_id}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={
                        c.status === "active" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                        c.status === "trialing" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                        c.status === "past_due" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                        "bg-white/10 text-white/60 border-white/20"
                      }>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-white/70">{c.quantity}</td>
                    <td className="px-4 py-3 text-right text-white">R$ {Number(c.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-[#0A1020] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar add-on</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="bg-white/5 border-white/10" rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Preço mensal (R$)</Label>
                  <Input type="number" step="0.01" value={editing.monthly_price} onChange={(e) => setEditing({ ...editing, monthly_price: Number(e.target.value) })} className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <Label>Plano mínimo</Label>
                  <Select value={editing.minimum_plan ?? "none"} onValueChange={(v) => setEditing({ ...editing, minimum_plan: v === "none" ? null : v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Qtd máx.</Label>
                  <Input type="number" value={editing.max_quantity} onChange={(e) => setEditing({ ...editing, max_quantity: Number(e.target.value) })} className="bg-white/5 border-white/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Module key</Label>
                  <Input value={editing.module_key} onChange={(e) => setEditing({ ...editing, module_key: e.target.value })} className="bg-white/5 border-white/10 font-mono text-xs" />
                </div>
                <div>
                  <Label>Trial (dias)</Label>
                  <Input type="number" value={editing.trial_days} onChange={(e) => setEditing({ ...editing, trial_days: Number(e.target.value) })} className="bg-white/5 border-white/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stripe Price ID (test)</Label>
                  <Input value={editing.stripe_price_id_test ?? ""} onChange={(e) => setEditing({ ...editing, stripe_price_id_test: e.target.value })} className="bg-white/5 border-white/10 font-mono text-xs" placeholder="price_..." />
                </div>
                <div>
                  <Label>Stripe Price ID (live)</Label>
                  <Input value={editing.stripe_price_id_live ?? ""} onChange={(e) => setEditing({ ...editing, stripe_price_id_live: e.target.value })} className="bg-white/5 border-white/10 font-mono text-xs" placeholder="price_..." />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Ativo no catálogo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && updateMutation.mutate(editing)}
              disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
