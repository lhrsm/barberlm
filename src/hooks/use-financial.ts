import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function useFinancial(tenantId: string | null, startDate?: string, endDate?: string) {
  const start = startDate || format(new Date(), "yyyy-MM-01");
  const end = endDate || format(new Date(), "yyyy-MM-dd");

  const summaryQuery = useQuery({
    queryKey: ["financial-summary", tenantId, start, end],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase.rpc("fn_get_financial_summary", {
        p_tenant_id: tenantId,
        p_start_date: start,
        p_end_date: end,
      });
      if (error) throw error;
      return data as {
        servicos_vendidos: number;
        entrada_caixa: number;
        cashback_concedido: number;
        cashback_utilizado: number;
        creditos_utilizados: number;
        assinatura_coberta: number;
        assinatura_extra: number;
        atendimentos_assinatura: number;
      };
    },
    enabled: !!tenantId,
  });

  return {
    summary: summaryQuery.data,
    isLoading: summaryQuery.isLoading,
    error: summaryQuery.error,
    refresh: summaryQuery.refetch
  };
}
