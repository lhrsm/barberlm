import { z } from "zod";
import type { AITool, AIContext } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { computeTotals, computeDre } from "@/components/finances/erp/engine";

/**
 * Service to aggregate data for AI Tools.
 * Each function follows strict read-only patterns and respects multi-tenancy.
 */

export const AIInternalServices = {
  /**
   * Financial Summary Implementation
   */
  getFinancialSummary: async (input: { start_date: string; end_date: string; professional_id?: string }, context: AIContext) => {
    const { tenant_id } = context;
    const { start_date, end_date, professional_id } = input;

    // Parallel fetch of all necessary data for ERP engine
    // Using explicit table names that exist in the schema
    const [
      transactionsRes,
      appointmentsRes,
      productSalesRes,
      cashbackRes,
      creditsRes,
      subscriptionsRes,
      commissionsRes
    ] = await Promise.all([
      supabase.from("transactions").select("*").eq("tenant_id", tenant_id).gte("date", start_date).lte("date", end_date),
      supabase.from("appointments").select("*").eq("tenant_id", tenant_id).gte("start_time", start_date).lte("start_time", end_date),
      supabase.from("product_sales").select("*").eq("tenant_id", tenant_id).gte("created_at", start_date).lte("created_at", end_date),
      supabase.from("cashback_transactions").select("*").eq("tenant_id", tenant_id).gte("created_at", start_date).lte("created_at", end_date),
      supabase.from("credits_transactions").select("*").eq("tenant_id", tenant_id).gte("created_at", start_date).lte("created_at", end_date),
      supabase.from("subscriptions").select("*").eq("tenant_id", tenant_id),
      supabase.from("commissions").select("*").eq("tenant_id", tenant_id).gte("created_at", start_date).lte("created_at", end_date)
    ]);

    // Handle potential errors or empty data gracefully
    const transactions = transactionsRes.data || [];
    const appointments = appointmentsRes.data || [];
    const productSales = productSalesRes.data || [];
    const cashback = cashbackRes.data || [];
    const credits = creditsRes.data || [];
    const subscriptions = subscriptionsRes.data || [];
    const commissions = commissionsRes.data || [];

    // Filter by professional if requested
    const filteredAppointments = professional_id 
      ? appointments.filter(a => a.barber_id === professional_id)
      : appointments;

    const totals = computeTotals({
      transactions,
      appointments: filteredAppointments,
      commissions,
      productSales,
      cashback,
      credits,
      subscriptions
    });

    const dre = computeDre(totals);

    return {
      period: { start: start_date, end: end_date },
      summary: totals,
      dre: dre,
      is_filtered_by_professional: !!professional_id
    };
  },

  /**
   * Appointment Summary Implementation
   */
  getAppointmentSummary: async (input: { start_date: string; end_date: string }, context: AIContext) => {
    const { tenant_id } = context;
    const { data: appointments } = await supabase
      .from("appointments")
      .select("status, total_price, final_amount, start_time")
      .eq("tenant_id", tenant_id)
      .gte("start_time", input.start_date)
      .lte("start_time", input.end_date);

    if (!appointments) return { total: 0, status_breakdown: {} };

    const status_breakdown = appointments.reduce((acc: Record<string, number>, curr) => {
      const status = curr.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: appointments.length,
      status_breakdown,
      completed_revenue: appointments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (Number(a.final_amount) || Number(a.total_price) || 0), 0)
    };
  }
};
