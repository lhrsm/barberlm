import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Camada de LEITURA da Central de Inteligência Comercial.
 * Somente SELECTs sobre dados já existentes — nenhuma regra de negócio,
 * nenhuma escrita, nenhuma automação disparada aqui.
 */

const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export interface IntelligenceData {
  customers: any[];
  appointments: any[];
  services: any[];
  barbers: any[];
  products: any[];
  productSales: any[];
  coupons: any[];
  credits: any[];
  subscriptions: any[];
  reviews: any[];
}

const EMPTY: IntelligenceData = {
  customers: [],
  appointments: [],
  services: [],
  barbers: [],
  products: [],
  productSales: [],
  coupons: [],
  credits: [],
  subscriptions: [],
  reviews: [],
};

async function safe<T>(p: PromiseLike<{ data: T | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await p;
    if (error) {
      console.warn("[intelligence] leitura ignorada:", error.message);
      return [];
    }
    return (data as any) || [];
  } catch (err) {
    console.warn("[intelligence] leitura falhou:", err);
    return [];
  }
}

export function useIntelligenceData(tenantId: string | null) {
  const query = useQuery({
    queryKey: ["commercial-intelligence", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async (): Promise<IntelligenceData> => {
      if (!tenantId) return EMPTY;

      const [
        customers,
        appointments,
        services,
        barbers,
        products,
        productSales,
        coupons,
        credits,
        subscriptions,
        reviews,
      ] = await Promise.all([
        safe(
          supabase
            .from("customers")
            .select(
              "id,name,phone,email,birth_date,cashback_balance,credit_balance,credits,total_spent,lifetime_value,last_visit,created_at,barber_id,allow_marketing",
            )
            .eq("tenant_id", tenantId)
            .limit(2000),
        ),
        safe(
          supabase
            .from("appointments")
            .select(
              "id,customer_id,barber_id,service_id,start_time,end_time,status,total_price,final_amount,products_amount,created_at,cancelled_at,appointment_type",
            )
            .eq("tenant_id", tenantId)
            .gte("start_time", daysAgoIso(240))
            .order("start_time", { ascending: false })
            .limit(4000),
        ),
        safe(supabase.from("services").select("id,name,price,active,duration_minutes").eq("tenant_id", tenantId)),
        safe(supabase.from("barbers").select("id,name,active,avatar_url,working_hours").eq("tenant_id", tenantId)),
        safe(
          supabase
            .from("products")
            .select("id,name,price,promotional_price,stock_quantity,active,category,created_at")
            .eq("user_id", tenantId),
        ),
        safe(
          supabase
            .from("product_sales")
            .select("id,customer_id,total_amount,status,items,created_at")
            .eq("tenant_id", tenantId)
            .gte("created_at", daysAgoIso(120))
            .limit(2000),
        ),
        safe(
          supabase
            .from("coupons")
            .select("id,code,type,value,usage_limit,used_count,starts_at,expires_at,active")
            .eq("tenant_id", tenantId),
        ),
        safe(
          supabase
            .from("customer_credits")
            .select("id,customer_id,available_amount,used_amount,amount,status,expires_at,created_at")
            .eq("tenant_id", tenantId)
            .limit(2000),
        ),
        safe(
          supabase
            .from("customer_subscriptions")
            .select("id,customer_id,plan_id,status,current_period_end,next_billing_at,uses_this_period,started_at")
            .eq("tenant_id", tenantId)
            .limit(1000),
        ),
        safe(
          supabase
            .from("appointment_reviews")
            .select(
              "id,customer_id,appointment_id,barber_rating,barbershop_rating,service_rating,testimonial_text,testimonial_status,submitted_at,created_at,reply",
            )
            .eq("tenant_id", tenantId)
            .gte("created_at", daysAgoIso(180))
            .limit(2000),
        ),
      ]);

      return { customers, appointments, services, barbers, products, productSales, coupons, credits, subscriptions, reviews };
    },
  });

  return {
    data: query.data || EMPTY,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
