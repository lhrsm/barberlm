import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Camada de LEITURA da Central de Marketing.
 * Somente SELECTs sobre dados já existentes — nenhuma regra de negócio,
 * nenhuma escrita, nenhuma automação disparada aqui.
 */

const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export interface MarketingData {
  campaigns: any[];
  campaignLogs: any[];
  automations: any[];
  automationTemplates: any[];
  automationLogs: any[];
  cashbackTx: any[];
  loyaltyCampaigns: any[];
}

const EMPTY: MarketingData = {
  campaigns: [],
  campaignLogs: [],
  automations: [],
  automationTemplates: [],
  automationLogs: [],
  cashbackTx: [],
  loyaltyCampaigns: [],
};

async function safe<T>(p: PromiseLike<{ data: T | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await p;
    if (error) {
      console.warn("[marketing] leitura ignorada:", error.message);
      return [];
    }
    return (data as any) || [];
  } catch (err) {
    console.warn("[marketing] leitura falhou:", err);
    return [];
  }
}

export function useMarketingData(tenantId: string | null) {
  const query = useQuery({
    queryKey: ["marketing-center", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async (): Promise<MarketingData> => {
      if (!tenantId) return EMPTY;

      const [campaigns, campaignLogs, automations, automationTemplates, automationLogs, cashbackTx, loyaltyCampaigns] =
        await Promise.all([
          safe(
            supabase
              .from("campaigns")
              .select("id,title,content,scheduled_at,status,filters,total_recipients,created_at,updated_at")
              .eq("tenant_id", tenantId)
              .order("created_at", { ascending: false })
              .limit(300),
          ),
          safe(
            supabase
              .from("campaign_logs")
              .select("id,campaign_id,customer_id,status,response,sent_at")
              .eq("tenant_id", tenantId)
              .limit(3000),
          ),
          safe(
            supabase
              .from("automations")
              .select("id,type,enabled,channel,trigger_type,trigger_delay,updated_at,created_at")
              .eq("tenant_id", tenantId)
              .limit(200),
          ),
          safe(
            supabase
              .from("automation_templates")
              .select("id,name,key,trigger_event,channel,active,category,recipient,updated_at,last_notified_at")
              .eq("tenant_id", tenantId)
              .limit(300),
          ),
          safe(
            supabase
              .from("automation_logs")
              .select("id,automation_id,status,message_type,final_status,sent_at,created_at,error_message")
              .eq("tenant_id", tenantId)
              .gte("created_at", daysAgoIso(60))
              .order("created_at", { ascending: false })
              .limit(3000),
          ),
          safe(
            supabase
              .from("cashback_transactions")
              .select("id,customer_id,type,amount,created_at")
              .eq("tenant_id", tenantId)
              .gte("created_at", daysAgoIso(180))
              .limit(3000),
          ),
          safe(
            supabase
              .from("loyalty_campaigns")
              .select("id,name,description,category,status,rule_type,starts_at,ends_at,created_at")
              .eq("tenant_id", tenantId)
              .limit(200),
          ),
        ]);

      return { campaigns, campaignLogs, automations, automationTemplates, automationLogs, cashbackTx, loyaltyCampaigns };
    },
  });

  return {
    data: query.data || EMPTY,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
