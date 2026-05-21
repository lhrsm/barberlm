import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Check, 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  MessageSquare,
  Award,
  Zap,
  Layout,
  BarChart,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/plans")({
  component: AdminPlans,
});

function AdminPlans() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("price_monthly");
      if (error) throw error;
      return data;
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (plan: any) => {
      const { error } = await supabase
        .from("plans")
        .update({
          price_monthly: plan.price_monthly,
          features: plan.features,
          limits: plan.limits
        })
        .eq("id", plan.id);
      
      if (error) throw error;

      // Log action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          action: 'update_plan',
          details: { plan_id: plan.id, plan_name: plan.name }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditingPlan(null);
      toast.success("Plano atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar plano: " + error.message);
    }
  });

  const startEditing = (plan: any) => {
    setEditingPlan(plan.id);
    setEditForm({ ...plan });
  };

  const toggleFeature = (feature: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features[feature]
      }
    }));
  };

  const updateLimit = (key: string, value: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      limits: {
        ...prev.limits,
        [key]: parseInt(value) || -1
      }
    }));
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Carregando planos...</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic uppercase">Níveis de Assinatura</h2>
          <p className="text-gray-400 font-medium">Configure os recursos e limites de cada nível do SaaS.</p>
        </div>
        <Button 
          onClick={() => toast.info("Funcionalidade de criar planos em breve")}
          className="h-12 px-8 rounded-2xl bg-white/5 border-white/10 text-white gap-2 font-bold uppercase tracking-wider text-xs italic transition-all hover:bg-white/10"
        >
          <Plus className="mr-2 h-4 w-4 text-purple-400" /> Novo Plano
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className={cn(
            "relative flex flex-col glass border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-purple-500/30 transition-all duration-500",
            editingPlan === plan.id ? "ring-2 ring-purple-500 border-purple-500" : ""
          )}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pt-8 px-8 pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl font-black text-white italic tracking-tighter uppercase">{plan.name}</CardTitle>
                  <CardDescription className="text-gray-400 font-medium">{plan.description}</CardDescription>
                </div>
                <Badge className={cn(
                  "rounded-lg px-2 py-0.5 text-[10px] border-none font-bold uppercase tracking-tighter",
                  plan.active 
                    ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                    : "bg-gray-500/20 text-gray-400"
                )}>
                  {plan.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="mt-4">
                {editingPlan === plan.id ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium">R$</span>
                    <Input 
                      type="number" 
                      className="h-8 w-24 inline-block mx-1" 
                      value={editForm.price_monthly}
                      onChange={(e) => setEditForm({...editForm, price_monthly: parseFloat(e.target.value)})}
                    />
                    <span className="text-sm text-muted-foreground">/ mês</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 text-2xl font-bold">
                    R$ {plan.price_monthly}
                    <span className="text-sm font-normal text-muted-foreground">/ mês</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Zap size={12} /> Recursos
                </p>
                <div className="space-y-2">
                  {Object.entries(plan.features || {}).map(([key, enabled]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm capitalize">
                        {key === 'whatsapp' && <MessageSquare size={14} className="text-green-500" />}
                        {key === 'cashback' && <Award size={14} className="text-amber-500" />}
                        {key === 'ia' && <Zap size={14} className="text-purple-500" />}
                        {key === 'reports' && <BarChart size={14} className="text-blue-500" />}
                        {key === 'advanced_analytics' && <Layout size={14} className="text-rose-500" />}
                        <span>{key.replace('_', ' ')}</span>
                      </div>
                      {editingPlan === plan.id ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => toggleFeature(key)}
                        >
                          {editForm.features[key] ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-destructive" />}
                        </Button>
                      ) : (
                        enabled ? <Check size={16} className="text-green-500" /> : <X size={16} className="text-muted-foreground/30" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <AlertTriangle size={12} /> Limites Mensais
                </p>
                <div className="space-y-2">
                  {Object.entries(plan.limits || {}).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{key === 'users' ? 'Usuários' : key === 'clients' ? 'Clientes' : 'Agendamentos'}</span>
                      {editingPlan === plan.id ? (
                        <Input 
                          type="number" 
                          className="h-7 w-20 text-right" 
                          value={editForm.limits[key]}
                          onChange={(e) => updateLimit(key, e.target.value)}
                        />
                      ) : (
                        <span className="font-medium">{val === -1 ? 'Ilimitado' : val}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 p-4">
              {editingPlan === plan.id ? (
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingPlan(null)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={() => updatePlanMutation.mutate(editForm)}>
                    <Save className="mr-2 h-4 w-4" /> Salvar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1" onClick={() => startEditing(plan)}>
                    <Edit2 className="mr-2 h-4 w-4" /> Editar
                  </Button>
                  <Button variant="ghost" className="px-2 text-destructive hover:bg-destructive/10" onClick={() => toast.error("Não é possível excluir planos em uso")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
