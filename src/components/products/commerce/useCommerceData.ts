import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * READ-ONLY data layer for the Commercial Center.
 * Never writes. Never mutates existing business rules.
 */
export type CommerceData = {
  products: any[];
  sales: any[];
  customers: any[];
  coupons: any[];
  cashback: any[];
};

export function useCommerceData(userId?: string | null) {
  return useQuery<CommerceData>({
    queryKey: ["commerce-center", userId],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      const sinceIso = since.toISOString();

      const [productsRes, salesRes, customersRes, couponsRes, cashbackRes] = await Promise.all([
        supabase.from("products").select("*").eq("user_id", userId!).order("name"),
        supabase
          .from("product_sales")
          .select("id, items, total_amount, status, customer_id, barber_id, appointment_id, created_at")
          .eq("user_id", userId!)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("customers").select("id, name, phone, cashback_balance, last_visit").limit(2000),
        supabase.from("coupons").select("*").limit(500),
        supabase
          .from("cashback_transactions")
          .select("id, amount, type, created_at, customer_id, description")
          .gte("created_at", sinceIso)
          .limit(2000),
      ]);

      return {
        products: productsRes.data || [],
        sales: salesRes.data || [],
        customers: customersRes.data || [],
        coupons: couponsRes.data || [],
        cashback: cashbackRes.data || [],
      };
    },
  });
}
