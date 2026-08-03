import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals, computeDre, breakdowns, dailySeries } from "@/components/finances/erp/engine";

const BIInputSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  compare_start_date: z.string().optional(),
  compare_end_date: z.string().optional(),
  filters: z.record(z.any()).optional()
});

export const getBIAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BIInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authSupabase } = context as any;
    
    if (!userId || !authSupabase) {
      throw new Error("Unauthorized: You must be logged in to view BI analytics");
    }
    
    // Resolve Tenant
    const { data: profile } = await authSupabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (!profile?.tenant_id) throw new Error("Tenant not found");
    const tenantId = profile.tenant_id;

    // Fetch primary data for a period
    const fetchPeriodData = async (start: string, end: string) => {
      const [
        transactions,
        appointments,
        productSales,
        cashback,
        credits,
        subscriptions,
        commissions,
        barbers
      ] = await Promise.all([
        authSupabase.from("transactions").select("*").eq("tenant_id", tenantId).gte("date", start).lte("date", end),
        authSupabase.from("appointments").select("*, services:service_id(name), customers:customer_id(name)").eq("tenant_id", tenantId).gte("start_time", start).lte("start_time", end),
        authSupabase.from("product_sales").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
        authSupabase.from("cashback_transactions").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
        authSupabase.from("credit_transactions").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
        authSupabase.from("customer_subscriptions").select("*").eq("tenant_id", tenantId),
        authSupabase.from("barber_commissions").select("*").eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
        authSupabase.from("profiles").select("id, full_name").eq("tenant_id", tenantId).eq("role", "barber")
      ]);

      const t = transactions.data || [];
      const app = (appointments.data as any[]) || [];
      const ps = productSales.data || [];
      const comm = (commissions.data as any[]) || [];

      const totals = computeTotals({
        transactions: t,
        appointments: app,
        commissions: comm.map(c => ({ ...c, commission_amount: c.commission_amount || 0 })),
        productSales: ps,
        cashback: cashback.data || [],
        credits: credits.data || [],
        subscriptions: subscriptions.data || []
      });

      const dre = computeDre(totals);
      const b = breakdowns({
        transactions: t,
        appointments: app,
        productSales: ps,
        commissions: comm
      });

      const series = dailySeries(t, { start: new Date(start), end: new Date(end) });

      return {
        totals,
        dre,
        breakdowns: b,
        series,
        barbersCount: barbers.data?.length || 0
      };
    };

    const current = await fetchPeriodData(data.start_date, data.end_date);
    let comparison = null;

    if (data.compare_start_date && data.compare_end_date) {
      comparison = await fetchPeriodData(data.compare_start_date, data.compare_end_date);
    }

    return {
      current,
      comparison,
      period: { start: data.start_date, end: data.end_date },
      metadata: {
        last_sync: new Date().toISOString(),
        currency: "BRL"
      }
    };
  });
