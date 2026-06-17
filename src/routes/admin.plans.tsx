import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Crown, Edit2, Save, X, Check, Lock } from "lucide-react";

export const Route = createFileRoute("/admin/plans")({
  component: AdminPlans,
});

interface Plan {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  tier: number;
  max_barbers: number | null;
  is_recommended: boolean;
  allowed_modules: string[];
  active: boolean;
}

const MODULE_CATALOG: { key: string; label: string; group: string }[] = [
  // Core
  { key: "dashboard", label: "Dashboard", group: "Core" },
  { key: "calendar", label: "Agenda", group: "Core" },
  { key: "customers", label: "Clientes", group: "Core" },
  { key: "barbers", label: "Barbeiros", group: "Core" },
  { key: "services", label: "Serviços", group: "Core" },
  { key: "finances", label: "Financeiro", group: "Core" },
  { key: "support", label: "Suporte", group: "Core" },
  // Growth
  { key: "commissions", label: "Comissões", group: "Crescimento" },
  { key: "loyalty", label: "Fidelidade", group: "Crescimento" },
  { key: "campaigns", label: "Campanhas", group: "Crescimento" },
  { key: "coupons", label: "Cupons", group: "Crescimento" },
  { key: "whatsapp", label: "WhatsApp", group: "Crescimento" },
  // Premium
  { key: "subscriptions", label: "Assinaturas", group: "Premium" },
  { key: "cashback", label: "Cashback", group: "Premium" },
  { key: "products", label: "Loja / Produtos", group: "Premium" },
  { key: "automations", label: "Automações", group: "Premium" },
  { key: "subscription_rewards", label: "Benefícios de assinatura", group: "Premium" },
  { key: "integrations", label: "Integrações", group: "Premium" },
  { key: "tutorials", label: "Tutoriais", group: "Premium" },
  { key: "pix_key", label: "Chave PIX", group: "Premium" },
  // Enterprise
  { key: "multi_units", label: "Multi-unidades", group: "Enterprise" },
  { key: "white_label", label: "White Label", group: "Enterprise" },
  { key: "api_access", label: "API", group: "Enterprise" },
  { key: "corporate_reports", label: "Relatórios corporativos", group: "Enterprise" },
];

const GROUPS = ["Core", "Crescimento", "Premium", "Enterprise"] as const;

function AdminPlans() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, slug, description, price_monthly, price_yearly, tier, max_barbers, is_recommended, allowed_modules, active")
        .order("tier", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        allowed_modules: Array.isArray(p.allowed_modules) ? p.allowed_modules : [],
        tier: p.tier ?? 0,
      })) as Plan[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      const { error } = await supabase
        .from("plans")
        .update({
          name: plan.name,
          description: plan.description,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          tier: plan.tier,
          max_barbers: plan.max_barbers,
          is_recommended: plan.is_recommended,
          allowed_modules: plan.allowed_modules,
          active: plan.active,
        } as any)
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans-modules"] });
      qc.invalidateQueries({ queryKey: ["barbershop-plan"] });
      setEditing(null);
      toast.success("Plano atualizado");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  useEffect(() => {
    if (editing && plans) {
      const p = plans.find((x) => x.id === editing);
      if (p) setForm({ ...p });
    } else {
      setForm(null);
    }
  }, [editing, plans]);

  const toggleModule = (key: string) => {
    if (!form) return;
    const has = form.allowed_modules.includes(key);
    setForm({
      ...form,
      allowed_modules: has
        ? form.allowed_modules.filter((m) => m !== key)
        : [...form.allowed_modules, key],
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-white/60">Carregando planos...</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-8 bg-amber-500" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-400">Super Admin</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white italic uppercase">Planos & Módulos</h1>
          <p className="text-sm text-white/60 mt-2">Configure o preço, limite de barbeiros e os módulos permitidos em cada plano.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {plans?.map((plan) => {
          const isEditing = editing === plan.id;
          const current = isEditing && form ? form : plan;
          const allowedSet = new Set(current.allowed_modules);

          return (
            <Card
              key={plan.id}
              className={cn(
                "glass rounded-3xl border-2 transition-all flex flex-col",
                isEditing
                  ? "border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
                  : plan.is_recommended
                  ? "border-amber-500/40"
                  : "border-white/10",
              )}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    {isEditing ? (
                      <Input
                        value={current.name}
                        onChange={(e) => setForm({ ...current, name: e.target.value })}
                        className="h-9 text-lg font-bold bg-white/5 border-white/10"
                      />
                    ) : (
                      <CardTitle className="text-2xl font-black text-white italic uppercase flex items-center gap-2">
                        {plan.name}
                        {plan.is_recommended && <Crown className="w-4 h-4 text-amber-400" />}
                      </CardTitle>
                    )}
                    <CardDescription className="text-white/50 text-xs mt-1">
                      Tier {current.tier} · slug: <code className="text-amber-400">{plan.slug}</code>
                    </CardDescription>
                  </div>
                  <Badge className={plan.active ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-zinc-500/20 text-zinc-400"}>
                    {plan.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-5">
                {/* Price + limits */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-white/50">Preço/mês</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={current.price_monthly}
                        onChange={(e) => setForm({ ...current, price_monthly: parseFloat(e.target.value) || 0 })}
                        className="h-9 bg-white/5 border-white/10 mt-1"
                      />
                    ) : (
                      <p className="text-xl font-black text-white mt-1">R$ {Number(plan.price_monthly).toFixed(2)}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-white/50">Máx. barbeiros</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={current.max_barbers ?? ""}
                        placeholder="Ilimitado"
                        onChange={(e) =>
                          setForm({
                            ...current,
                            max_barbers: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        className="h-9 bg-white/5 border-white/10 mt-1"
                      />
                    ) : (
                      <p className="text-xl font-black text-white mt-1">{plan.max_barbers ?? "∞"}</p>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <Label className="text-xs text-white/70">Marcar como recomendado</Label>
                    <Switch
                      checked={current.is_recommended}
                      onCheckedChange={(v) => setForm({ ...current, is_recommended: v })}
                    />
                  </div>
                )}

                {/* Allowed modules */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-white/50">
                    Módulos permitidos ({current.allowed_modules.length})
                  </Label>
                  <div className="mt-3 space-y-3">
                    {GROUPS.map((group) => {
                      const items = MODULE_CATALOG.filter((m) => m.group === group);
                      return (
                        <div key={group}>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">{group}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {items.map((m) => {
                              const on = allowedSet.has(m.key);
                              return (
                                <button
                                  key={m.key}
                                  type="button"
                                  disabled={!isEditing}
                                  onClick={() => toggleModule(m.key)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all text-left",
                                    on
                                      ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                                      : "bg-white/5 border-white/10 text-white/40",
                                    isEditing && "hover:border-amber-500/60 cursor-pointer",
                                    !isEditing && "cursor-default opacity-90",
                                  )}
                                >
                                  {on ? <Check className="w-3 h-3 shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
                                  <span className="truncate">{m.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-4 border-t border-white/10">
                {isEditing ? (
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="ghost"
                      className="flex-1 text-white/60"
                      onClick={() => setEditing(null)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
                      onClick={() => form && updateMutation.mutate(form)}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    onClick={() => setEditing(plan.id)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editar plano
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="glass border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-5 text-sm text-amber-200/80">
          💡 <strong>Como funciona:</strong> ao alterar os módulos permitidos de um plano, todas as barbearias que <em>já estão</em> nesse plano não perdem o que tinham ativado — apenas os registros de <code>barbershop_modules</code> existentes continuam. Novos módulos liberados aparecem como "Disponíveis" para a barbearia ativar; módulos removidos do plano deixam de aparecer no menu e são bloqueados nas rotas. A trigger de sync é executada automaticamente sempre que uma barbearia troca de plano.
        </CardContent>
      </Card>
    </div>
  );
}
