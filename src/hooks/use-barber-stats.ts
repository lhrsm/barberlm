import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for barber dashboard / commission / financial tabs.
 * Reads from get_barber_dashboard_summary / barber_commissions (SECURITY DEFINER RPC) and also
 * pulls next appointment + cancellations from the same data the agenda uses.
 */
export async function fetchBarberStats(barberId: string) {
  // discover tenant from barbers table
  const { data: barber } = await supabase
    .from("barbers")
    .select("tenant_id, user_id, commission_rate")
    .eq("id", barberId)
    .maybeSingle();

  const tenantId = barber?.tenant_id || barber?.user_id;

  if (!tenantId) {
    return {
      today: 0, week: 0, month: 0,
      revenueMonth: 0, commissionMonth: 0, commissionPaid: 0, commissionPending: 0,
      avgTicket: 0, customerCount: 0, nextApp: null, cancelledMonth: 0,
    };
  }

  const { data, error } = await supabase.rpc("get_barber_dashboard_summary", {
    p_tenant_id: tenantId,
    p_barber_id: barberId,
  });

  if (error) {
    console.error("[BARBER_DASH_RPC_ERROR]", error);
    throw error;
  }

  const s: any = data || {};

  // distinct customer count (best effort; uses agenda RPC, already RLS-safe)
  let customerCount = 0;
  let nextApp: any = s.next_appointment ? { start_time: s.next_appointment } : null;
  try {
    const { data: apps } = await supabase.rpc("get_barber_appointments", { p_barber_id: barberId });
    const list: any[] = Array.isArray(apps) ? apps : [];
    customerCount = new Set(list.filter(a => a.status === "completed").map(a => a.customer_id)).size;
    if (!nextApp) {
      const now = Date.now();
      nextApp = list
        .filter(a => new Date(a.start_time).getTime() > now && (a.status === "scheduled" || a.status === "confirmed"))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] || null;
    }
  } catch {}

  const result = {
    today: Number(s.appointments_today || 0),
    week: Number(s.appointments_week || 0),
    month: Number(s.appointments_month || 0),
    revenueMonth: Number(s.gross_production || 0),
    commissionMonth: Number(s.commission_generated || 0),
    commissionPaid: Number(s.commission_paid || 0),
    commissionPending: Number(s.commission_pending || 0),
    avgTicket: Number(s.average_ticket || 0),
    customerCount,
    nextApp,
    cancelledMonth: Number(s.cancelled_count || 0),
  };

  console.log("[BARBER_STATS_COMPUTED]", { barberId, ...result });
  return result;
}
