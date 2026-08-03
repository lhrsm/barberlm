import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals } from "@/components/finances/erp/engine";

export const getBIAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: any) => z.object({
    start_date: z.string(),
    end_date: z.string(),
    compare_start_date: z.string().optional(),
    compare_end_date: z.string().optional(),
    filters: z.record(z.any()).optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authSupabase } = context;
    
    // Resolve Tenant
    const { data: profile } = await authSupabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (!profile?.tenant_id) throw new Error("Tenant not found");
    const tenantId = profile.tenant_id;

    // Fetch primary data for the selected period
    const fetchPeriodData = async (start: string, end: string) => {
      const [
        transactions,
        appointments,
        productSales,
        cashback,
        credits,
        subscriptions,
        commissions
      ] = await Promise.all([
        authSupabase.from("transactions").select("*").eq("tenant_id", tenantId).gte("date", start).lte("date", end),
        authSupabase.from("appointments").select("*").eq("tenant_id", tenantId).gte("start_time", start).lte("start_time", end),
        authSupabase.from("product_sales").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
        authSupabase.from("cashback_transactions").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
        authSupabase.from("credit_transactions").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
        authSupabase.from("customer_subscriptions").select("*").eq("tenant_id", tenantId),
        authSupabase.from("barber_commissions").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end)
      ]);

      return computeTotals({
        transactions: transactions.data || [],
        appointments: (appointments.data as any[]) || [],
        commissions: (commissions.data as any[])?.map(c => ({ ...c, commission_amount: c.commission_amount || 0 })) || [],
        productSales: productSales.data || [],
        cashback: cashback.data || [],
        credits: credits.data || [],
        subscriptions: subscriptions.data || []
      });
    };

    const currentTotals = await fetchPeriodData(data.start_date, data.end_date);
    let comparisonTotals = null;

    if (data.compare_start_date && data.compare_end_date) {
      comparisonTotals = await fetchPeriodData(data.compare_start_date, data.compare_end_date);
    }

    return {
      current: currentTotals,
      comparison: comparisonTotals,
      period: { start: data.start_date, end: data.end_date },
      metadata: {
        last_sync: new Date().toISOString(),
        currency: "BRL"
      }
    };
  });
