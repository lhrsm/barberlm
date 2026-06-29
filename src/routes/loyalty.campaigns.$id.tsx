import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { withModule } from "@/components/modules/withModule";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Sparkles, Trash2 } from "lucide-react";

export const Route = createFileRoute("/loyalty/campaigns/$id")({
  component: withModule("loyalty", "Editor de Campanha", CampaignEditor),
});

function CampaignEditor() {
  const { id } = useParams({ from: "/loyalty/campaigns/$id" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [c, setC] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("loyalty_campaigns" as any).select("*").eq("id", id).maybeSingle();
      setC(data || null);
      setLoading(false);
    })();
  }, [id]);

  function set<K extends string>(k: K, v: any) {
    setC((prev: any) => ({ ...prev, [k]: v }));
  }
  function setConfig(k: string, v: any) {
    setC((prev: any) => ({ ...prev, config: { ...(prev.config || {}), [k]: v } }));
  }
  function setReward(k: string, v: any) {
    setC((prev: any) => ({ ...prev, reward: { ...(prev.reward || {}), [k]: v } }));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("loyalty_campaigns" as any)
      .update({
        name: c.name,
        description: c.description,
        category: c.category,
        status: c.status,
        rule_type: c.rule_type,
        config: c.config,
        reward: c.reward,
        starts_at: c.starts_at || null,
        ends_at: c.ends_at || null,
        image_url: c.image_url || null,
        icon: c.icon,
        color: c.color,
        badge: c.badge,
        allow_stacking: !!c.allow_stacking,
        allow_combine: !!c.allow_combine,
        limit_per_customer: c.limit_per_customer || null,
        limit_per_campaign: c.limit_per_campaign || null,
        notify_whatsapp: !!c.notify_whatsapp,
        notify_email: !!c.notify_email,
        notify_push: !!c.notify_push,
        notify_portal: !!c.notify_portal,
        message_template: c.message_template,
      })
      .eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Campanha salva!");
  }

  async function remove() {
    if (!confirm("Excluir esta campanha?")) return;
    await supabase.from("loyalty_campaigns" as any).delete().eq("id", id);
    toast.success("Excluída");
    navigate({ to: "/loyalty/campaigns" });
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#05070d] grid place-items-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#f59e0b]" />
        </div>
      </AppLayout>
    );
  }
  if (!c) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#05070d] grid place-items-center text-white">Campanha não encontrada</div>
      </AppLayout>
    );
  }

  const config = c.config || {};
  const reward = c.reward || {};

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-6 max-w-[1100px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/loyalty/campaigns" className="h-10 w-10 rounded-xl border border-zinc-800 grid place-items-center text-zinc-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <p className="text-xs text-[#f59e0b] uppercase tracking-wider font-bold">Editando</p>
                <h1 className="text-2xl md:text-3xl font-black truncate">{c.name}</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={remove} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4 mr-2" />Excluir
              </Button>
              <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black font-bold">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </div>
          </div>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="bg-[#0b0f17] border border-zinc-800 p-1 rounded-xl flex-wrap h-auto">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="regras">Regras</TabsTrigger>
              <TabsTrigger value="recompensa">Recompensa</TabsTrigger>
              <TabsTrigger value="periodo">Período</TabsTrigger>
              <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
              <TabsTrigger value="visual">Visual</TabsTrigger>
              <TabsTrigger value="avancado">Avançado</TabsTrigger>
            </TabsList>

            {/* GERAL */}
            <TabsContent value="geral" className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 space-y-4 mt-3">
              <Field label="Nome">
                <Input value={c.name || ""} onChange={(e) => set("name", e.target.value)} className="bg-[#05070d] border-zinc-800" />
              </Field>
              <Field label="Descrição">
                <Textarea value={c.description || ""} onChange={(e) => set("description", e.target.value)} className="bg-[#05070d] border-zinc-800" rows={3} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Categoria">
                  <Select value={c.category || ""} onValueChange={(v) => set("category", v)}>
                    <SelectTrigger className="bg-[#05070d] border-zinc-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crescimento">Crescimento</SelectItem>
                      <SelectItem value="recorrencia">Recorrência</SelectItem>
                      <SelectItem value="cashback">Cashback</SelectItem>
                      <SelectItem value="assinaturas">Assinaturas</SelectItem>
                      <SelectItem value="datas">Datas comemorativas</SelectItem>
                      <SelectItem value="personalizadas">Personalizadas</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={c.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger className="bg-[#05070d] border-zinc-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                      <SelectItem value="expired">Expirada</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </TabsContent>

            {/* REGRAS */}
            <TabsContent value="regras" className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 space-y-4 mt-3">
              <Field label="Tipo de regra">
                <Select value={c.rule_type} onValueChange={(v) => set("rule_type", v)}>
                  <SelectTrigger className="bg-[#05070d] border-zinc-800"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visits">Quantidade de atendimentos</SelectItem>
                    <SelectItem value="spend">Valor gasto</SelectItem>
                    <SelectItem value="cashback_tiers">Cashback progressivo</SelectItem>
                    <SelectItem value="birthday">Aniversariante</SelectItem>
                    <SelectItem value="referral">Indicação</SelectItem>
                    <SelectItem value="subscription_tenure">Tempo de assinatura</SelectItem>
                    <SelectItem value="product_spend">Compra de produtos</SelectItem>
                    <SelectItem value="challenge">Desafio (período)</SelectItem>
                    <SelectItem value="campaign_window">Campanha temporária</SelectItem>
                    <SelectItem value="consecutive_months">Meses consecutivos</SelectItem>
                    <SelectItem value="no_show_streak">Sem faltas</SelectItem>
                    <SelectItem value="corporate">Corporativo</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {(c.rule_type === "visits" || c.rule_type === "spend" || c.rule_type === "product_spend" || c.rule_type === "challenge" || c.rule_type === "consecutive_months") && (
                <Field label="Meta">
                  <Input type="number" value={config.target ?? ""} onChange={(e) => setConfig("target", Number(e.target.value))} className="bg-[#05070d] border-zinc-800" />
                </Field>
              )}

              {c.rule_type === "cashback_tiers" && (
                <div className="space-y-2">
                  <Label className="text-zinc-300">Faixas de cashback</Label>
                  {(config.tiers || []).map((t: any, i: number) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="Até R$"
                        value={t.up_to ?? ""}
                        onChange={(e) => {
                          const tiers = [...(config.tiers || [])];
                          tiers[i] = { ...t, up_to: e.target.value ? Number(e.target.value) : null };
                          setConfig("tiers", tiers);
                        }}
                        className="bg-[#05070d] border-zinc-800"
                      />
                      <Input
                        type="number"
                        placeholder="%"
                        value={t.percent ?? ""}
                        onChange={(e) => {
                          const tiers = [...(config.tiers || [])];
                          tiers[i] = { ...t, percent: Number(e.target.value) };
                          setConfig("tiers", tiers);
                        }}
                        className="bg-[#05070d] border-zinc-800 w-24"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const tiers = [...(config.tiers || [])];
                          tiers.splice(i, 1);
                          setConfig("tiers", tiers);
                        }}
                        className="border-zinc-800 text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfig("tiers", [...(config.tiers || []), { up_to: null, percent: 5 }])}
                    className="border-zinc-800 text-zinc-300"
                  >
                    + Adicionar faixa
                  </Button>
                </div>
              )}

              <Field label="Período (challenge / spend)">
                <Select value={config.period || "none"} onValueChange={(v) => setConfig("period", v === "none" ? null : v)}>
                  <SelectTrigger className="bg-[#05070d] border-zinc-800"><SelectValue placeholder="Sem período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem período</SelectItem>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Filtro de serviço (opcional, ex: corte, barba, combo)">
                <Input value={config.service_filter || ""} onChange={(e) => setConfig("service_filter", e.target.value)} className="bg-[#05070d] border-zinc-800" />
              </Field>
            </TabsContent>

            {/* RECOMPENSA */}
            <TabsContent value="recompensa" className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 space-y-4 mt-3">
              <Field label="Tipo de recompensa">
                <Select value={reward.type || "custom"} onValueChange={(v) => setReward("type", v)}>
                  <SelectTrigger className="bg-[#05070d] border-zinc-800"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free_service">Serviço grátis</SelectItem>
                    <SelectItem value="discount">Desconto (%)</SelectItem>
                    <SelectItem value="permanent_discount">Desconto permanente</SelectItem>
                    <SelectItem value="cashback">Cashback</SelectItem>
                    <SelectItem value="credit">Crédito (R$)</SelectItem>
                    <SelectItem value="product">Produto</SelectItem>
                    <SelectItem value="free_product">Produto grátis</SelectItem>
                    <SelectItem value="gift">Brinde</SelectItem>
                    <SelectItem value="upgrade">Upgrade de plano</SelectItem>
                    <SelectItem value="vip_status">Status VIP</SelectItem>
                    <SelectItem value="status">Status personalizado</SelectItem>
                    <SelectItem value="custom">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Valor (R$ ou %)">
                  <Input type="number" value={reward.amount ?? reward.percent ?? ""} onChange={(e) => setReward(reward.type === "cashback" || reward.type?.includes("discount") ? "percent" : "amount", Number(e.target.value))} className="bg-[#05070d] border-zinc-800" />
                </Field>
                <Field label="Quantidade">
                  <Input type="number" value={reward.quantity ?? ""} onChange={(e) => setReward("quantity", Number(e.target.value))} className="bg-[#05070d] border-zinc-800" />
                </Field>
              </div>
              <Field label="Validade (dias)">
                <Input type="number" value={config.validity_days ?? ""} onChange={(e) => setConfig("validity_days", Number(e.target.value))} className="bg-[#05070d] border-zinc-800" />
              </Field>
              <Field label="Descrição da recompensa">
                <Input value={reward.description || ""} onChange={(e) => setReward("description", e.target.value)} className="bg-[#05070d] border-zinc-800" />
              </Field>
            </TabsContent>

            {/* PERÍODO */}
            <TabsContent value="periodo" className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Data inicial">
                  <Input type="datetime-local" value={c.starts_at?.slice(0, 16) || ""} onChange={(e) => set("starts_at", e.target.value)} className="bg-[#05070d] border-zinc-800" />
                </Field>
                <Field label="Data final">
                  <Input type="datetime-local" value={c.ends_at?.slice(0, 16) || ""} onChange={(e) => set("ends_at", e.target.value)} className="bg-[#05070d] border-zinc-800" />
                </Field>
              </div>
            </TabsContent>

            {/* MENSAGENS */}
            <TabsContent value="mensagens" className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 space-y-4 mt-3">
              <Field label="Mensagem ao desbloquear recompensa">
                <Textarea value={c.message_template || ""} onChange={(e) => set("message_template", e.target.value)} rows={4} className="bg-[#05070d] border-zinc-800" placeholder="Parabéns {{cliente_nome}}! Você desbloqueou..." />
              </Field>
              <Label className="text-zinc-300">Canais de notificação</Label>
              <div className="grid grid-cols-2 gap-3">
                <Toggle label="WhatsApp" value={c.notify_whatsapp} onChange={(v) => set("notify_whatsapp", v)} />
                <Toggle label="E-mail" value={c.notify_email} onChange={(v) => set("notify_email", v)} />
                <Toggle label="Push" value={c.notify_push} onChange={(v) => set("notify_push", v)} />
                <Toggle label="Portal do cliente" value={c.notify_portal} onChange={(v) => set("notify_portal", v)} />
              </div>
            </TabsContent>

            {/* VISUAL */}
            <TabsContent value="visual" className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ícone (Lucide)"><Input value={c.icon || ""} onChange={(e) => set("icon", e.target.value)} className="bg-[#05070d] border-zinc-800" /></Field>
                <Field label="Cor (hex)"><Input value={c.color || ""} onChange={(e) => set("color", e.target.value)} className="bg-[#05070d] border-zinc-800" /></Field>
              </div>
              <Field label="Badge"><Input value={c.badge || ""} onChange={(e) => set("badge", e.target.value)} className="bg-[#05070d] border-zinc-800" /></Field>
              <Field label="URL da imagem"><Input value={c.image_url || ""} onChange={(e) => set("image_url", e.target.value)} className="bg-[#05070d] border-zinc-800" /></Field>
            </TabsContent>

            {/* AVANÇADO */}
            <TabsContent value="avancado" className="bg-[#0b0f17] border border-zinc-800 rounded-2xl p-6 space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <Toggle label="Permitir acumular com outras" value={c.allow_stacking} onChange={(v) => set("allow_stacking", v)} />
                <Toggle label="Permitir combinar" value={c.allow_combine} onChange={(v) => set("allow_combine", v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Limite por cliente"><Input type="number" value={c.limit_per_customer ?? ""} onChange={(e) => set("limit_per_customer", Number(e.target.value) || null)} className="bg-[#05070d] border-zinc-800" /></Field>
                <Field label="Limite total da campanha"><Input type="number" value={c.limit_per_campaign ?? ""} onChange={(e) => set("limit_per_campaign", Number(e.target.value) || null)} className="bg-[#05070d] border-zinc-800" /></Field>
              </div>
              <Field label="Valor mínimo"><Input type="number" value={config.min_value ?? ""} onChange={(e) => setConfig("min_value", Number(e.target.value))} className="bg-[#05070d] border-zinc-800" /></Field>
              <Field label="Valor máximo"><Input type="number" value={config.max_value ?? ""} onChange={(e) => setConfig("max_value", Number(e.target.value))} className="bg-[#05070d] border-zinc-800" /></Field>

              <div className="pt-4 border-t border-zinc-800">
                <Label className="text-zinc-300 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#f59e0b]" />JSON bruto (apenas leitura)</Label>
                <pre className="mt-2 bg-[#05070d] border border-zinc-800 rounded-lg p-3 text-xs text-zinc-400 overflow-x-auto">
{JSON.stringify({ config, reward }, null, 2)}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between bg-[#05070d] border border-zinc-800 rounded-xl px-4 py-3">
      <span className="text-sm text-zinc-300">{label}</span>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}
