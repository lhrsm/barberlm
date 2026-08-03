import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { useErpFinance, erpPeriodRange } from "@/components/finances/erp/useErpFinance";
import { useIntelligenceData } from "@/components/intelligence/useIntelligenceData";
import { generateOperationalInsights, OperationalIntelligenceData, OperationalInsight } from "./engine";
import { useMemo } from "react";
import { toast } from "sonner";

export function useOperationalIntelligence() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  // Fetcheamos dados dos últimos 30 dias para análise operacional
  const range = useMemo(() => erpPeriodRange("30d"), []);
  const erp = useErpFinance(tenantId ?? null, range);
  const intel = useIntelligenceData(tenantId ?? null);

  // Busca as interações (dismissed, resolved, etc)
  const interactions = useQuery({
    queryKey: ["operational-insights-interactions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_insights_interactions")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data || [];
    }
  });

  // Mutação para salvar interações
  const interactMutation = useMutation({
    mutationFn: async ({ rule_key, entity_id, status, metadata }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("operational_insights_interactions")
        .upsert({
          tenant_id: tenantId!,
          user_id: user.id,
          rule_key,
          entity_id: entity_id || null,
          status,
          metadata,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,rule_key,entity_id' });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operational-insights-interactions"] });
      toast.success("Ação registrada com sucesso");
    },
    onError: (error: any) => {
      console.error("Erro ao registrar interação:", error);
      toast.error("Erro ao salvar sua preferência");
    }
  });

  const allData: OperationalIntelligenceData = useMemo(() => ({
    appointments: erp.appointments,
    customers: intel.data.customers,
    transactions: erp.transactions,
    products: intel.data.products,
    productSales: erp.productSales,
    barbers: intel.data.barbers,
    commissions: erp.commissions,
    subscriptions: erp.subscriptions,
    reviews: intel.data.reviews,
    interactions: interactions.data || []
  }), [erp, intel, interactions.data]);

  const insights = useMemo(() => generateOperationalInsights(allData), [allData]);

  return {
    insights,
    isLoading: erp.isLoading || intel.isLoading || interactions.isLoading,
    isFetching: erp.isLoading || intel.isFetching || interactions.isFetching,
    interact: interactMutation.mutate,
    refetch: () => {
      erp.refetch();
      intel.refetch();
      interactions.refetch();
    }
  };
}
