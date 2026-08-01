import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * READ-ONLY data layer for the commissions performance panel.
 * It never writes and never recalculates commission rules — it only reads
 * the same rows the existing module already relies on.
 */
export type PerfAppointment = {
  id: string;
  barber_id: string | null;
  customer_id: string | null;
  service_id: string | null;
  status: string | null;
  total_price: number | null;
  service_amount: number | null;
  products_amount: number | null;
  payment_method: string | null;
  start_time: string;
  end_time: string;
  completed_at: string | null;
};

export type PerfProductSale = {
  id: string;
  barber_id: string | null;
  customer_id: string | null;
  appointment_id: string | null;
  total_amount: number;
  items: any;
  status: string;
  created_at: string;
};

export type PerfReview = {
  id: string;
  barber_id: string | null;
  barber_rating: number | null;
  service_rating: number | null;
  barbershop_rating: number | null;
  created_at: string;
};

export type PerfCommissionEntry = {
  id: string;
  barber_id: string;
  appointment_id: string;
  customer_id: string | null;
  service_amount: number;
  commission_amount: number;
  commission_rate: number;
  commission_type: string;
  paid_amount: number;
  status: string;
  earned_at: string;
};

export type PerfData = {
  appointments: PerfAppointment[];
  productSales: PerfProductSale[];
  reviews: PerfReview[];
  historyEntries: PerfCommissionEntry[];
  services: { id: string; name: string; price: number }[];
  customers: { id: string; name: string | null }[];
};

const empty: PerfData = {
  appointments: [],
  productSales: [],
  reviews: [],
  historyEntries: [],
  services: [],
  customers: [],
};

export function useCommissionsPerf(
  tenantId: string | null,
  from: string,
  to: string,
  enabled = true,
) {
  const query = useQuery<PerfData>({
    queryKey: ["commissions-perf", tenantId, from, to],
    enabled: !!tenantId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      if (!tenantId) return empty;
      const startIso = `${from}T00:00:00`;
      const endIso = `${to}T23:59:59`;
      // 12 months back for trend / forecast comparisons
      const trendStart = new Date(from + "T00:00:00");
      trendStart.setMonth(trendStart.getMonth() - 11);
      const trendIso = trendStart.toISOString().slice(0, 10) + "T00:00:00";

      const [appts, sales, reviews, history, services, customers] =
        await Promise.all([
          supabase
            .from("appointments")
            .select(
              "id, barber_id, customer_id, service_id, status, total_price, service_amount, products_amount, payment_method, start_time, end_time, completed_at",
            )
            .eq("tenant_id", tenantId)
            .eq("status", "completed")
            .gte("start_time", trendIso)
            .lte("start_time", endIso)
            .order("start_time", { ascending: false })
            .limit(4000),
          supabase
            .from("product_sales")
            .select(
              "id, barber_id, customer_id, appointment_id, total_amount, items, status, created_at",
            )
            .eq("tenant_id", tenantId)
            .gte("created_at", trendIso)
            .lte("created_at", endIso)
            .limit(2000),
          supabase
            .from("appointment_reviews")
            .select(
              "id, barber_id, barber_rating, service_rating, barbershop_rating, created_at",
            )
            .eq("tenant_id", tenantId)
            .gte("created_at", trendIso)
            .lte("created_at", endIso)
            .limit(2000),
          supabase
            .from("commission_entries")
            .select(
              "id, barber_id, appointment_id, customer_id, service_amount, commission_amount, commission_rate, commission_type, paid_amount, status, earned_at",
            )
            .eq("tenant_id", tenantId)
            .gte("earned_at", trendIso)
            .lte("earned_at", endIso)
            .order("earned_at", { ascending: false })
            .limit(4000),
          supabase
            .from("services")
            .select("id, name, price")
            .eq("tenant_id", tenantId),
          supabase
            .from("customers")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .limit(3000),
        ]);

      return {
        appointments: (appts.data ?? []) as PerfAppointment[],
        productSales: (sales.data ?? []) as PerfProductSale[],
        reviews: (reviews.data ?? []) as PerfReview[],
        historyEntries: (history.data ?? []) as PerfCommissionEntry[],
        services: (services.data ?? []) as PerfData["services"],
        customers: (customers.data ?? []) as PerfData["customers"],
        _range: { startIso, endIso },
      } as PerfData;
    },
  });

  return {
    data: query.data ?? empty,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
