import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Resolves the operational context for the Command Center.
 * Aggregates data from multiple sources for a single operational view.
 */
export const resolveCommandCenterContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authSupabase } = context;
    
    // 1. Resolve Profile and Tenant
    const { data: profile } = await authSupabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", userId)
      .single();

    if (!profile || !profile.tenant_id) throw new Error("Profile or Tenant not found");
    const tenantId = profile.tenant_id;

    // Use a business date reference (Today in local time)
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00Z`;
    const endOfDay = `${today}T23:59:59Z`;

    // 2. Aggregate Data in Parallel with safer type handling
    const [
      barbershop,
      professionals,
      appointments,
      waitingClients,
      cashRegister,
      pendingPayments,
      pendingOrders,
      insights
    ] = await Promise.all([
      authSupabase.from("barbershops").select("*").eq("id", tenantId).single(),
      authSupabase.from("profiles").select("id, full_name, avatar_url, role").eq("tenant_id", tenantId).in("role", ["barber", "admin", "manager"]),
      authSupabase.from("appointments").select("*").eq("tenant_id", tenantId).gte("start_time", startOfDay).lte("start_time", endOfDay),
      authSupabase.from("waiting_list" as any).select("*").eq("tenant_id", tenantId).eq("status", "waiting"),
      authSupabase.from("cash_registers" as any).select("*").eq("tenant_id", tenantId).eq("status", "open").maybeSingle(),
      // Fix: Filter transactions by tenant and status correctly without assuming specific column availability in simple filters
      authSupabase.from("transactions").select("*").eq("tenant_id", tenantId).filter("status", "eq", "pending"),
      authSupabase.from("product_orders" as any).select("*").eq("tenant_id", tenantId).in("status", ["pending", "preparing"]),
      authSupabase.from("operational_insights" as any).select("*").eq("tenant_id", tenantId).eq("status", "active").limit(5)
    ]);

    // 3. Construct Operational Status
    const activeProfCount = professionals.data?.length || 0;
    const waitingCount = waitingClients.data?.length || 0;
    
    return {
      barbershop: barbershop.data,
      metrics: {
        active_professionals: activeProfCount,
        waiting_clients: waitingCount,
        in_progress: (appointments.data as any[])?.filter(a => a.status === 'in_progress').length || 0,
        pending_payments: pendingPayments.data?.length || 0,
        pending_orders: pendingOrders.data?.length || 0
      },
      appointments: (appointments.data as any[]) || [],
      waiting_list: (waitingClients.data as any[]) || [],
      cash_register: cashRegister.data as any,
      alerts: (insights.data as any[]) || [],
      professionals: (professionals.data as any[]) || [],
      business_date: today
    };
  });
