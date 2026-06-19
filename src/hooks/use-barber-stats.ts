import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function fetchBarberStats(barberId: string) {
  const now = new Date();
  const tStart = startOfDay(now).toISOString();
  const tEnd = endOfDay(now).toISOString();
  const wStart = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
  const wEnd = endOfWeek(now, { weekStartsOn: 0 }).toISOString();
  const mStart = startOfMonth(now).toISOString();
  const mEnd = endOfMonth(now).toISOString();

  const { data: barber } = await supabase
    .from("barbers")
    .select("commission_rate")
    .eq("id", barberId)
    .maybeSingle();

  // IMPORTANT: barber panel runs under the anon session (custom barber auth),
  // so direct SELECT on appointments is blocked by RLS for confirmed/completed
  // rows. Always go through the SECURITY DEFINER RPC, same source the
  // appointments list uses — keeps dashboard, history, commissions and
  // financial screens in sync.
  const { data: rpcData, error } = await supabase
    .rpc("get_barber_appointments", { p_barber_id: barberId });

  if (error) {
    console.error("[BARBER_STATS_RPC_ERROR]", error);
    throw error;
  }

  const allApps: any[] = Array.isArray(rpcData) ? rpcData : [];

  const inRange = (a: any, s: string, e: string) =>
    a.start_time >= s && a.start_time <= e;

  const todayApps = allApps.filter(a => inRange(a, tStart, tEnd) && a.status !== 'cancelled');
  const weekApps = allApps.filter(a => inRange(a, wStart, wEnd) && a.status !== 'cancelled');
  const monthApps = allApps.filter(a => inRange(a, mStart, mEnd));

  const monthCompletedApps = monthApps.filter(a => a.status === 'completed');
  const monthCancelledApps = monthApps.filter(a => a.status === 'cancelled');

  const totalRevenueMonth = monthCompletedApps.reduce(
    (acc, a) => acc + Number(a.total_price || 0), 0
  );

  const commissionRate = Number(barber?.commission_rate || 0) / 100;
  const commissionMonth = totalRevenueMonth * commissionRate;

  const distinctCustomers = new Set(
    allApps.filter(a => a.status === 'completed').map(a => a.customer_id)
  ).size;
  const avgTicket = monthCompletedApps.length > 0
    ? totalRevenueMonth / monthCompletedApps.length
    : 0;

  const nextApp = allApps
    .filter(a => new Date(a.start_time) > now && (a.status === 'scheduled' || a.status === 'confirmed'))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  const result = {
    today: todayApps.length,
    week: weekApps.length,
    month: monthApps.filter(a => a.status !== 'cancelled').length,
    revenueMonth: totalRevenueMonth,
    commissionMonth,
    avgTicket,
    customerCount: distinctCustomers,
    nextApp,
    cancelledMonth: monthCancelledApps.length,
  };

  console.log("[BARBER_STATS_COMPUTED]", {
    barberId,
    totalAppointments: allApps.length,
    completedThisMonth: monthCompletedApps.length,
    revenueMonth: totalRevenueMonth,
    commissionRate,
    commissionMonth,
  });

  return result;
}
