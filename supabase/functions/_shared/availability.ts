
import { format } from "https://esm.sh/date-fns@2.30.0";
import { ptBR } from "https://esm.sh/date-fns@2.30.0/locale";

export async function getAvailableSlots(supabase: any, barberId: string, date: string, serviceDuration: number) {
  // 1. Get barber working hours
  const { data: barber, error: barberError } = await supabase
    .from("barbers")
    .select("working_hours")
    .eq("id", barberId)
    .single();

  if (barberError || !barber) return [];

  const dateObj = new Date(date + "T12:00:00");
  const dayName = format(dateObj, "eeee", { locale: ptBR }).toLowerCase();
  
  const dayMap: Record<string, string> = {
    'segunda-feira': 'monday',
    'terça-feira': 'tuesday',
    'quarta-feira': 'wednesday',
    'quinta-feira': 'thursday',
    'sexta-feira': 'friday',
    'sábado': 'saturday',
    'domingo': 'sunday'
  };
  
  const dayKey = dayMap[dayName] || dayName;
  const workingHours = (barber.working_hours as any)?.[dayKey];

  if (!workingHours || !workingHours.enabled) return [];

  // 2. Get existing appointments for that day
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("barber_id", barberId)
    .neq("status", "cancelled")
    .gte("start_time", startOfDay)
    .lte("start_time", endOfDay);

  const times = [];
  const [startHour, startMin] = workingHours.start.split(':').map(Number);
  const [endHour, endMin] = workingHours.end.split(':').map(Number);
  
  const [y, m, d] = date.split('-').map(Number);

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = (hour === startHour ? startMin : 0); min < 60; min += 30) {
      if (hour === endHour && min >= endMin) break;
      
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const checkTime = new Date(y, m - 1, d, hour, min, 0);
      const now = new Date();
      
      // If today, skip past times
      if (date === format(now, "yyyy-MM-dd") && checkTime < now) continue;

      const checkTimeMs = checkTime.getTime();
      const serviceEndMs = checkTimeMs + serviceDuration * 60 * 1000;

      // Check for conflicts
      const isBusy = appointments?.some((app: any) => {
        const appStart = new Date(app.start_time).getTime();
        const appEnd = new Date(app.end_time).getTime();
        return checkTimeMs < appEnd && serviceEndMs > appStart;
      });

      if (!isBusy) {
        times.push(timeStr);
      }
    }
  }

  return times;
}
