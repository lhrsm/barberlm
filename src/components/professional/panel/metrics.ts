/**
 * Motor de métricas do Painel do Barbeiro.
 * 100% derivado dos dados JÁ carregados na rota (appointments via
 * get_barber_appointments + commissionEntries via get_barber_commissions).
 * Nenhuma consulta nova, nenhuma regra de negócio alterada.
 */

export type Appt = any;

const num = (v: any) => Number(v || 0);
export const apptValue = (a: Appt) => num(a?.final_amount ?? a?.total_price);

export const isCompleted = (a: Appt) => a?.status === "completed";
export const isCancelled = (a: Appt) => a?.status === "cancelled" || a?.status === "no_show";
export const isPending = (a: Appt) => a?.status === "scheduled" || a?.status === "confirmed";

export function sameDay(d: Date, ref: Date) {
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function brl(v: number) {
  return `R$ ${num(v).toFixed(2).replace(".", ",")}`;
}

export interface TodaySummary {
  todayAppts: Appt[];
  completedToday: Appt[];
  pendingToday: Appt[];
  cancelledToday: number;
  revenueToday: number;
  ticketToday: number;
  clientsToday: number;
  avgDurationMin: number;
  next: Appt | null;
  current: Appt | null;
  minutesToNext: number | null;
  occupancyPct: number;
  freeSlots: number;
}

/** Resumo do dia corrente. */
export function buildTodaySummary(appointments: Appt[], slotMinutes = 30, workedHours = 10): TodaySummary {
  const now = new Date();
  const todayAppts = appointments
    .filter((a) => a.start_time && sameDay(new Date(a.start_time), now))
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));

  const completedToday = todayAppts.filter(isCompleted);
  const pendingToday = todayAppts.filter(isPending);
  const cancelledToday = todayAppts.filter(isCancelled).length;
  const revenueToday = completedToday.reduce((s, a) => s + apptValue(a), 0);
  const clientsToday = new Set(todayAppts.filter((a) => !isCancelled(a)).map((a) => a.customer_id)).size;

  const durations = todayAppts
    .filter((a) => a.start_time && a.end_time)
    .map((a) => (+new Date(a.end_time) - +new Date(a.start_time)) / 60000)
    .filter((m) => m > 0 && m < 600);
  const avgDurationMin = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const next =
    pendingToday.find((a) => +new Date(a.start_time) > +now) ||
    appointments
      .filter((a) => isPending(a) && +new Date(a.start_time) > +now)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))[0] ||
    null;

  const current =
    todayAppts.find(
      (a) =>
        isPending(a) &&
        +new Date(a.start_time) <= +now &&
        a.end_time &&
        +new Date(a.end_time) >= +now,
    ) || null;

  const minutesToNext = next ? Math.round((+new Date(next.start_time) - +now) / 60000) : null;

  const totalSlots = Math.max(1, Math.round((workedHours * 60) / slotMinutes));
  const busySlots = todayAppts.filter((a) => !isCancelled(a)).length;
  const occupancyPct = Math.min(100, Math.round((busySlots / totalSlots) * 100));

  return {
    todayAppts,
    completedToday,
    pendingToday,
    cancelledToday,
    revenueToday,
    ticketToday: completedToday.length ? revenueToday / completedToday.length : 0,
    clientsToday,
    avgDurationMin,
    next,
    current,
    minutesToNext,
    occupancyPct,
    freeSlots: Math.max(0, totalSlots - busySlots),
  };
}

export interface EvolutionData {
  monthly: { label: string; revenue: number; count: number; ticket: number }[];
  weekly: { label: string; revenue: number; count: number }[];
  topServices: { name: string; count: number; total: number }[];
  topClients: { id: string; name: string; count: number; total: number; last: string }[];
  weekdays: { label: string; count: number; revenue: number }[];
  hours: { label: string; revenue: number; count: number }[];
  avgDurationMin: number;
  bestWeekday: string | null;
  bestHour: string | null;
  loyalClient: { name: string; count: number } | null;
  ticketTrendPct: number | null;
  topServiceName: string | null;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Série histórica (últimos 12 meses) e rankings pessoais. */
export function buildEvolution(appointments: Appt[]): EvolutionData {
  const now = new Date();
  const completed = appointments.filter(isCompleted);

  // 12 meses
  const monthly: EvolutionData["monthly"] = [];
  for (let i = 11; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const rows = completed.filter((a) => {
      const d = new Date(a.start_time);
      return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
    });
    const revenue = rows.reduce((s, a) => s + apptValue(a), 0);
    monthly.push({
      label: `${MONTH_LABELS[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`,
      revenue: Number(revenue.toFixed(2)),
      count: rows.length,
      ticket: rows.length ? Number((revenue / rows.length).toFixed(2)) : 0,
    });
  }

  // 8 semanas
  const weekly: EvolutionData["weekly"] = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const rows = completed.filter((a) => {
      const d = new Date(a.start_time);
      return d >= start && d <= end;
    });
    weekly.push({
      label: `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`,
      revenue: Number(rows.reduce((s, a) => s + apptValue(a), 0).toFixed(2)),
      count: rows.length,
    });
  }

  // serviços
  const svc: Record<string, { name: string; count: number; total: number }> = {};
  completed.forEach((a) => {
    const name = a.services?.name || "Serviço";
    svc[name] = svc[name] || { name, count: 0, total: 0 };
    svc[name].count += 1;
    svc[name].total += apptValue(a);
  });
  const topServices = Object.values(svc).sort((a, b) => b.total - a.total).slice(0, 6);

  // clientes
  const cli: Record<string, { id: string; name: string; count: number; total: number; last: string }> = {};
  completed.forEach((a) => {
    const id = a.customer_id || a.customers?.name || "anon";
    cli[id] = cli[id] || { id, name: a.customers?.name || "Cliente", count: 0, total: 0, last: a.start_time };
    cli[id].count += 1;
    cli[id].total += apptValue(a);
    if (+new Date(a.start_time) > +new Date(cli[id].last)) cli[id].last = a.start_time;
  });
  const topClients = Object.values(cli).sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 8);

  // dia da semana
  const wd = WEEKDAY_LABELS.map((label) => ({ label, count: 0, revenue: 0 }));
  completed.forEach((a) => {
    const d = new Date(a.start_time);
    wd[d.getDay()].count += 1;
    wd[d.getDay()].revenue += apptValue(a);
  });

  // horários
  const hoursMap: Record<string, { label: string; revenue: number; count: number }> = {};
  completed.forEach((a) => {
    const h = String(new Date(a.start_time).getHours()).padStart(2, "0") + "h";
    hoursMap[h] = hoursMap[h] || { label: h, revenue: 0, count: 0 };
    hoursMap[h].revenue += apptValue(a);
    hoursMap[h].count += 1;
  });
  const hours = Object.values(hoursMap).sort((a, b) => a.label.localeCompare(b.label));

  const durations = completed
    .filter((a) => a.start_time && a.end_time)
    .map((a) => (+new Date(a.end_time) - +new Date(a.start_time)) / 60000)
    .filter((m) => m > 0 && m < 600);
  const avgDurationMin = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const bestWeekdayRow = [...wd].sort((a, b) => b.revenue - a.revenue)[0];
  const bestHourRow = [...hours].sort((a, b) => b.revenue - a.revenue)[0];
  const loyal = topClients[0] ? { name: topClients[0].name, count: topClients[0].count } : null;

  const curTicket = monthly[11]?.ticket || 0;
  const prevTicket = monthly[10]?.ticket || 0;
  const ticketTrendPct = prevTicket > 0 ? Number((((curTicket - prevTicket) / prevTicket) * 100).toFixed(1)) : null;

  return {
    monthly,
    weekly,
    topServices,
    topClients,
    weekdays: wd,
    hours,
    avgDurationMin,
    bestWeekday: bestWeekdayRow && bestWeekdayRow.revenue > 0 ? bestWeekdayRow.label : null,
    bestHour: bestHourRow ? bestHourRow.label : null,
    loyalClient: loyal,
    ticketTrendPct,
    topServiceName: topServices[0]?.name || null,
  };
}

export interface Insight {
  id: string;
  tone: "gold" | "positive" | "warning" | "neutral";
  text: string;
}

/** Insights e objetivos — puramente baseados em regras sobre dados existentes. */
export function buildInsights(
  today: TodaySummary,
  evo: EvolutionData,
  stats: any,
  goal: number,
  productionMonth: number,
): { insights: Insight[]; objectives: Insight[] } {
  const insights: Insight[] = [];
  const objectives: Insight[] = [];

  if (today.todayAppts.length > 0) {
    insights.push({
      id: "occ",
      tone: today.occupancyPct >= 70 ? "positive" : "neutral",
      text: `Hoje sua agenda está ${today.occupancyPct}% ocupada (${today.todayAppts.length} atendimentos).`,
    });
  } else {
    insights.push({ id: "occ-empty", tone: "neutral", text: "Você ainda não tem atendimentos marcados para hoje." });
  }

  if (evo.ticketTrendPct !== null && Math.abs(evo.ticketTrendPct) >= 1) {
    insights.push({
      id: "ticket",
      tone: evo.ticketTrendPct > 0 ? "positive" : "warning",
      text:
        evo.ticketTrendPct > 0
          ? `Você aumentou seu ticket médio em ${evo.ticketTrendPct}% em relação ao mês passado.`
          : `Seu ticket médio caiu ${Math.abs(evo.ticketTrendPct)}% em relação ao mês passado.`,
    });
  }

  if (evo.topServiceName) {
    insights.push({ id: "svc", tone: "gold", text: `Seu serviço mais realizado foi ${evo.topServiceName}.` });
  }
  if (evo.bestWeekday) {
    insights.push({ id: "wd", tone: "neutral", text: `${evo.bestWeekday} é o seu dia mais produtivo da semana.` });
  }
  if (evo.bestHour) {
    insights.push({ id: "hr", tone: "neutral", text: `Seu horário de maior faturamento é às ${evo.bestHour}.` });
  }
  if (evo.avgDurationMin > 0) {
    insights.push({ id: "dur", tone: "neutral", text: `Seu tempo médio por atendimento é de ${evo.avgDurationMin} minutos.` });
  }
  if (Number(stats?.cancelledMonth || 0) > 0) {
    insights.push({
      id: "cancel",
      tone: "warning",
      text: `Você teve ${stats.cancelledMonth} cancelamento(s) neste mês. Confirmar antes reduz faltas.`,
    });
  }
  if (evo.loyalClient && evo.loyalClient.count > 1) {
    insights.push({
      id: "loyal",
      tone: "gold",
      text: `${evo.loyalClient.name} é seu cliente mais fiel, com ${evo.loyalClient.count} atendimentos.`,
    });
  }

  // Objetivos
  if (goal > 0) {
    const missing = goal - productionMonth;
    if (missing > 0) {
      objectives.push({ id: "goal", tone: "gold", text: `Faltam ${brl(missing)} para você bater sua meta do mês.` });
      const ticket = Number(stats?.avgTicket || evo.monthly[11]?.ticket || 0);
      if (ticket > 0) {
        objectives.push({
          id: "goal-appt",
          tone: "neutral",
          text: `Isso equivale a aproximadamente ${Math.ceil(missing / ticket)} atendimentos.`,
        });
      }
    } else {
      objectives.push({ id: "goal-done", tone: "positive", text: "Parabéns! Você já bateu sua meta mensal. 🎉" });
    }
  }

  const best = [...evo.monthly].slice(0, 11).sort((a, b) => b.revenue - a.revenue)[0];
  if (best && best.revenue > 0) {
    const diff = best.revenue - (evo.monthly[11]?.revenue || 0);
    objectives.push(
      diff > 0
        ? { id: "record", tone: "neutral", text: `Faltam ${brl(diff)} para bater seu recorde mensal (${best.label}).` }
        : { id: "record-done", tone: "positive", text: `Este é o seu melhor mês até agora! 🏆` },
    );
  }

  if (today.pendingToday.length > 0) {
    objectives.push({
      id: "pending",
      tone: "neutral",
      text: `Você ainda tem ${today.pendingToday.length} atendimento(s) para concluir hoje.`,
    });
  }

  return { insights, objectives };
}
