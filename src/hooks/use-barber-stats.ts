import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function fetchBarberStats(barberId: string) {
  const now = new Date();
  const tStart = startOfDay(now).toISOString();
  const tEnd = endOfDay(now).toISOString();
  const wStart = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
  const wEnd = endOfWeek(now, { weekStartsOn: 0 }).toISOString();
  const mStart = startOfMonth(now).toISOString();
  const mEnd = endOfMonth(now).toISOString();

  const { data: allApps, error } = await supabase
    .from("appointments")
    .select("*, customers(name, phone, avatar_url), services(name)")
    .eq("barber_id", barberId);

  if (error || !allApps) return null;

  const todayCount = allApps.filter(a => a.start_time >= tStart && a.start_time <= tEnd && a.status !== 'cancelled').length;
  const weekCount = allApps.filter(a => a.start_time >= wStart && a.start_time <= wEnd && a.status !== 'cancelled').length;
  const monthApps = allApps.filter(a => a.start_time >= mStart && a.start_time <= mEnd);
  
  const monthCompletedApps = monthApps.filter(a => a.status === 'completed');
  const monthCancelledApps = monthApps.filter(a => a.status === 'cancelled');
  const totalRevenueMonth = monthCompletedApps.reduce((acc, a) => acc + Number(a.total_price || 0), 0);
  const distinctCustomers = new Set(allApps.filter(a => a.status === 'completed').map(a => a.customer_id)).size;
  const avgTicket = monthCompletedApps.length > 0 ? totalRevenueMonth / monthCompletedApps.length : 0;
  
  const nextApp = allApps
    .filter(a => new Date(a.start_time) > now && a.status === 'scheduled')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  return {
    today: todayCount,
    week: weekCount,
    month: monthApps.filter(a => a.status !== 'cancelled').length,
    revenueMonth: totalRevenueMonth,
    avgTicket,
    customerCount: distinctCustomers,
    nextApp,
    cancelledMonth: monthCancelledApps.length
  };
}
