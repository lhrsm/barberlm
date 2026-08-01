import type { PerfData, PerfAppointment } from "./useCommissionsPerf";

/**
 * PURE calculation engine for the commissions performance panel.
 * It NEVER recalculates commission rules — commission values always come from
 * the existing `commission_entries` rows produced by the backend.
 */

export type PerfBarber = {
  id: string;
  name: string;
  commission_type: string;
  commission_rate: number;
  commission_fixed_value: number;
  commission_bonus_value: number;
  monthly_goal: number;
};

const day = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : "");
const inRange = (iso: string | null | undefined, from: string, to: string) => {
  const d = day(iso);
  return !!d && d >= from && d <= to;
};

export const fmtBRL = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

function delta(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function shiftRange(from: string, to: string) {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  const span = Math.max(1, Math.round((+t - +f) / 86400000) + 1);
  const pf = new Date(f);
  pf.setDate(pf.getDate() - span);
  const pt = new Date(f);
  pt.setDate(pt.getDate() - 1);
  return {
    from: pf.toISOString().slice(0, 10),
    to: pt.toISOString().slice(0, 10),
    span,
  };
}

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  money: "Dinheiro",
  credit_card: "Crédito",
  debit_card: "Débito",
  card: "Cartão",
  mixed: "Misto",
  credits: "Créditos",
  cashback: "Cashback",
  subscription: "Assinatura",
};

export function paymentLabel(m?: string | null) {
  if (!m) return "Não informado";
  return PAYMENT_LABELS[m] ?? m;
}

export type BuildArgs = {
  data: PerfData;
  barbers: PerfBarber[];
  from: string;
  to: string;
  barberId: string; // "all" | id
};

export function buildPerf({ data, barbers, from, to, barberId }: BuildArgs) {
  const barberMatch = (id?: string | null) =>
    barberId === "all" ? true : id === barberId;

  const serviceName = new Map(data.services.map((s) => [s.id, s.name]));
  const customerName = new Map(data.customers.map((c) => [c.id, c.name ?? ""]));
  const barberName = new Map(barbers.map((b) => [b.id, b.name]));

  const apptsAll = data.appointments.filter((a) => barberMatch(a.barber_id));
  const appts = apptsAll.filter((a) =>
    inRange(a.completed_at || a.start_time, from, to),
  );
  const entriesAll = data.historyEntries.filter((e) => barberMatch(e.barber_id));
  const entries = entriesAll.filter((e) => inRange(e.earned_at, from, to));
  const salesAll = data.productSales.filter(
    (s) => barberMatch(s.barber_id) && s.status === "completed",
  );
  const sales = salesAll.filter((s) => inRange(s.created_at, from, to));
  const reviews = data.reviews.filter(
    (r) => barberMatch(r.barber_id) && inRange(r.created_at, from, to),
  );

  const prev = shiftRange(from, to);
  const prevAppts = apptsAll.filter((a) =>
    inRange(a.completed_at || a.start_time, prev.from, prev.to),
  );
  const prevEntries = entriesAll.filter((e) =>
    inRange(e.earned_at, prev.from, prev.to),
  );
  const prevSales = salesAll.filter((s) =>
    inRange(s.created_at, prev.from, prev.to),
  );

  const sum = (n: number[]) => n.reduce((a, b) => a + b, 0);
  const revenue = sum(appts.map((a) => Number(a.total_price ?? 0)));
  const prevRevenue = sum(prevAppts.map((a) => Number(a.total_price ?? 0)));
  const commissionTotal = sum(entries.map((e) => Number(e.commission_amount)));
  const commissionPaid = sum(entries.map((e) => Number(e.paid_amount)));
  const commissionPending = Math.max(0, commissionTotal - commissionPaid);
  const prevCommission = sum(
    prevEntries.map((e) => Number(e.commission_amount)),
  );
  const productRevenue = sum(sales.map((s) => Number(s.total_amount ?? 0)));
  const prevProductRevenue = sum(
    prevSales.map((s) => Number(s.total_amount ?? 0)),
  );

  const productUnits = sales.reduce((acc, s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    return (
      acc +
      (items.length
        ? items.reduce((n: number, i: any) => n + Number(i?.quantity ?? 1), 0)
        : 1)
    );
  }, 0);

  const servicesCount = appts.length;
  const avgTicket = servicesCount ? revenue / servicesCount : 0;
  const prevAvgTicket = prevAppts.length ? prevRevenue / prevAppts.length : 0;
  const uniqueCustomers = new Set(appts.map((a) => a.customer_id).filter(Boolean))
    .size;

  const ratingValues = reviews
    .map((r) =>
      Number(r.barber_rating ?? r.service_rating ?? r.barbershop_rating ?? 0),
    )
    .filter((v) => v > 0);
  const avgRating = ratingValues.length
    ? sum(ratingValues) / ratingValues.length
    : 0;

  const workedMinutes = sum(
    appts.map((a) => {
      const s = +new Date(a.start_time);
      const e = +new Date(a.end_time);
      const m = (e - s) / 60000;
      return Number.isFinite(m) && m > 0 && m < 600 ? m : 30;
    }),
  );
  const revenuePerHour = workedMinutes ? revenue / (workedMinutes / 60) : 0;

  // Period buckets ------------------------------------------------------
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  })();
  const monthStart = todayStr.slice(0, 8) + "01";
  const commissionIn = (f: string, t: string) =>
    sum(
      entriesAll
        .filter((e) => inRange(e.earned_at, f, t))
        .map((e) => Number(e.commission_amount)),
    );

  const buckets = {
    day: commissionIn(todayStr, todayStr),
    week: commissionIn(weekStart, todayStr),
    month: commissionIn(monthStart, todayStr),
  };

  // Daily series --------------------------------------------------------
  const dailyMap = new Map<
    string,
    { date: string; commission: number; revenue: number; services: number; products: number }
  >();
  const ensure = (d: string) => {
    if (!dailyMap.has(d))
      dailyMap.set(d, {
        date: d,
        commission: 0,
        revenue: 0,
        services: 0,
        products: 0,
      });
    return dailyMap.get(d)!;
  };
  entries.forEach((e) => {
    const b = ensure(day(e.earned_at));
    b.commission += Number(e.commission_amount);
  });
  appts.forEach((a) => {
    const b = ensure(day(a.completed_at || a.start_time));
    b.revenue += Number(a.total_price ?? 0);
    b.services += 1;
  });
  sales.forEach((s) => {
    const b = ensure(day(s.created_at));
    b.products += Number(s.total_amount ?? 0);
  });
  const dailySeries = [...dailyMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
    }));

  // Weekly series (ISO-ish week buckets within range)
  const weeklyMap = new Map<string, { label: string; commission: number; revenue: number }>();
  dailySeries.forEach((d) => {
    const dt = new Date(d.date + "T00:00:00");
    const ws = new Date(dt);
    ws.setDate(ws.getDate() - ws.getDay());
    const key = ws.toISOString().slice(0, 10);
    const cur =
      weeklyMap.get(key) ??
      { label: `Sem. ${key.slice(8, 10)}/${key.slice(5, 7)}`, commission: 0, revenue: 0 };
    cur.commission += d.commission;
    cur.revenue += d.revenue;
    weeklyMap.set(key, cur);
  });
  const weeklySeries = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);

  // Monthly series (12 months, uses full dataset, not range-restricted)
  const monthlyMap = new Map<
    string,
    { label: string; commission: number; revenue: number; products: number; services: number }
  >();
  const monthEnsure = (k: string) => {
    if (!monthlyMap.has(k))
      monthlyMap.set(k, {
        label: `${k.slice(5, 7)}/${k.slice(2, 4)}`,
        commission: 0,
        revenue: 0,
        products: 0,
        services: 0,
      });
    return monthlyMap.get(k)!;
  };
  entriesAll.forEach((e) => {
    monthEnsure(day(e.earned_at).slice(0, 7)).commission += Number(
      e.commission_amount,
    );
  });
  apptsAll.forEach((a) => {
    const m = monthEnsure(day(a.completed_at || a.start_time).slice(0, 7));
    m.revenue += Number(a.total_price ?? 0);
    m.services += 1;
  });
  salesAll.forEach((s) => {
    monthEnsure(day(s.created_at).slice(0, 7)).products += Number(
      s.total_amount ?? 0,
    );
  });
  const monthlySeries = [...monthlyMap.entries()]
    .filter(([k]) => k.length === 7)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, v]) => v);

  // Commission ratio (average effective rate observed in the data)
  const commissionRatio = (() => {
    const base = sum(entries.map((e) => Number(e.service_amount || 0)));
    return base > 0 ? commissionTotal / base : 0;
  })();

  // By service ----------------------------------------------------------
  const entryByAppt = new Map(entries.map((e) => [e.appointment_id, e]));
  const svcMap = new Map<
    string,
    { name: string; count: number; revenue: number; commission: number }
  >();
  appts.forEach((a) => {
    const key = a.service_id ?? "sem-servico";
    const cur =
      svcMap.get(key) ??
      {
        name: serviceName.get(a.service_id ?? "") ?? "Sem serviço",
        count: 0,
        revenue: 0,
        commission: 0,
      };
    cur.count += 1;
    cur.revenue += Number(a.total_price ?? 0);
    cur.commission += Number(
      entryByAppt.get(a.id)?.commission_amount ?? 0,
    );
    svcMap.set(key, cur);
  });
  const byService = [...svcMap.values()]
    .map((s) => ({ ...s, avgTicket: s.count ? s.revenue / s.count : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // By product ----------------------------------------------------------
  const prodMap = new Map<
    string,
    { name: string; units: number; revenue: number; cost: number }
  >();
  sales.forEach((s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    if (!items.length) {
      const cur = prodMap.get("Outros") ?? { name: "Outros", units: 0, revenue: 0, cost: 0 };
      cur.units += 1;
      cur.revenue += Number(s.total_amount ?? 0);
      prodMap.set("Outros", cur);
      return;
    }
    items.forEach((i: any) => {
      const name = String(i?.name ?? i?.product_name ?? "Produto");
      const qty = Number(i?.quantity ?? 1);
      const price = Number(i?.price ?? i?.unit_price ?? 0);
      const cost = Number(i?.cost_price ?? i?.cost ?? 0) * qty;
      const cur = prodMap.get(name) ?? { name, units: 0, revenue: 0, cost: 0 };
      cur.units += qty;
      cur.revenue += price * qty;
      cur.cost += cost;
      prodMap.set(name, cur);
    });
  });
  const byProduct = [...prodMap.values()]
    .map((p) => ({
      ...p,
      profit: p.revenue - p.cost,
      commission: p.revenue * commissionRatio,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Timeline ------------------------------------------------------------
  const productsByAppt = new Map<string, number>();
  sales.forEach((s) => {
    if (s.appointment_id)
      productsByAppt.set(
        s.appointment_id,
        (productsByAppt.get(s.appointment_id) ?? 0) + Number(s.total_amount ?? 0),
      );
  });
  const timeline = appts
    .slice()
    .sort(
      (a, b) =>
        +new Date(b.completed_at || b.start_time) -
        +new Date(a.completed_at || a.start_time),
    )
    .map((a) => {
      const entry = entryByAppt.get(a.id);
      return {
        id: a.id,
        date: a.completed_at || a.start_time,
        customer: customerName.get(a.customer_id ?? "") || "Cliente",
        service: serviceName.get(a.service_id ?? "") || "Serviço",
        barber: barberName.get(a.barber_id ?? "") || "-",
        amount: Number(a.total_price ?? 0),
        commission: Number(entry?.commission_amount ?? 0),
        rate: Number(entry?.commission_rate ?? 0),
        commissionType: entry?.commission_type ?? "-",
        status: entry?.status ?? "pending",
        products: productsByAppt.get(a.id) ?? 0,
        payment: paymentLabel(a.payment_method),
      };
    });

  // Heatmap: weekday x hour --------------------------------------------
  const heat: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  appts.forEach((a) => {
    const d = new Date(a.start_time);
    heat[d.getDay()][d.getHours()] += Number(a.total_price ?? 0);
  });
  const heatMax = Math.max(1, ...heat.flat());

  const byWeekday = WEEKDAYS.map((name, i) => ({
    name,
    revenue: heat[i].reduce((a, b) => a + b, 0),
  }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, "0")}h`,
    hour: h,
    revenue: heat.reduce((acc, row) => acc + row[h], 0),
  })).filter((h) => h.revenue > 0 || (h.hour >= 8 && h.hour <= 20));

  const byPayment = (() => {
    const m = new Map<string, number>();
    appts.forEach((a) => {
      const k = paymentLabel(a.payment_method);
      m.set(k, (m.get(k) ?? 0) + Number(a.total_price ?? 0));
    });
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const byCustomer = (() => {
    const m = new Map<string, { name: string; revenue: number; visits: number }>();
    appts.forEach((a) => {
      const k = a.customer_id ?? "anon";
      const cur =
        m.get(k) ?? { name: customerName.get(k) || "Cliente", revenue: 0, visits: 0 };
      cur.revenue += Number(a.total_price ?? 0);
      cur.visits += 1;
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  // Ranking -------------------------------------------------------------
  const ranking = barbers.map((b) => {
    const ba = apptsAll.filter(
      (a) => a.barber_id === b.id && inRange(a.completed_at || a.start_time, from, to),
    );
    const be = entriesAll.filter(
      (e) => e.barber_id === b.id && inRange(e.earned_at, from, to),
    );
    const bs = salesAll.filter(
      (s) => s.barber_id === b.id && inRange(s.created_at, from, to),
    );
    const br = data.reviews.filter(
      (r) => r.barber_id === b.id && inRange(r.created_at, from, to),
    );
    const rev = sum(ba.map((a) => Number(a.total_price ?? 0)));
    const rt = br
      .map((r) => Number(r.barber_rating ?? r.service_rating ?? 0))
      .filter((v) => v > 0);
    return {
      id: b.id,
      name: b.name,
      revenue: rev,
      commission: sum(be.map((e) => Number(e.commission_amount))),
      services: ba.length,
      avgTicket: ba.length ? rev / ba.length : 0,
      products: sum(bs.map((s) => Number(s.total_amount ?? 0))),
      rating: rt.length ? sum(rt) / rt.length : 0,
      goal: Number(b.monthly_goal ?? 0),
    };
  });

  // Forecast ------------------------------------------------------------
  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const dayOfMonth = now.getDate();
  const monthCommission = commissionIn(monthStart, todayStr);
  const dailyAvg = monthCommission / Math.max(1, dayOfMonth);
  const forecast = {
    projected: dailyAvg * daysInMonth,
    min: dailyAvg * daysInMonth * 0.85,
    best: dailyAvg * daysInMonth * 1.2,
    current: monthCommission,
    dailyAvg,
    daysLeft: daysInMonth - dayOfMonth,
  };

  // Insights ------------------------------------------------------------
  const bestWeekday = [...byWeekday].sort((a, b) => b.revenue - a.revenue)[0];
  const bestHour = [...byHour].sort((a, b) => b.revenue - a.revenue)[0];
  const bestService = byService[0];
  const bestProduct = byProduct[0];
  const lateProducts = sales.filter(
    (s) => new Date(s.created_at).getHours() >= 17,
  ).length;

  const insights: { title: string; detail: string; tone: "gold" | "emerald" | "sky" }[] = [];
  if (bestWeekday && bestWeekday.revenue > 0)
    insights.push({
      title: `Seu melhor dia é ${bestWeekday.name}`,
      detail: `${fmtBRL(bestWeekday.revenue)} de receita concentrada neste dia da semana.`,
      tone: "gold",
    });
  if (bestHour && bestHour.revenue > 0)
    insights.push({
      title: `Seu melhor horário é às ${bestHour.label}`,
      detail: `${fmtBRL(bestHour.revenue)} gerados neste horário no período.`,
      tone: "sky",
    });
  if (bestService)
    insights.push({
      title: `Serviço mais rentável: ${bestService.name}`,
      detail: `${bestService.count} atendimentos · ${fmtBRL(bestService.revenue)} · comissão ${fmtBRL(bestService.commission)}.`,
      tone: "emerald",
    });
  if (bestProduct)
    insights.push({
      title: `Produto destaque: ${bestProduct.name}`,
      detail: `${bestProduct.units} unidades · ${fmtBRL(bestProduct.revenue)} em vendas.`,
      tone: "gold",
    });
  if (lateProducts > 0 && sales.length > 0)
    insights.push({
      title: "Vendas de produtos após as 17h",
      detail: `${Math.round((lateProducts / sales.length) * 100)}% das suas vendas acontecem no fim do dia.`,
      tone: "sky",
    });

  const analyses: { title: string; detail: string; positive: boolean }[] = [];
  const push = (label: string, cur: number, old: number, money = true) => {
    const d = delta(cur, old);
    if (!cur && !old) return;
    analyses.push({
      title: `${label} ${d >= 0 ? "aumentou" : "caiu"} ${Math.abs(d).toFixed(1)}%`,
      detail: `${money ? fmtBRL(cur) : cur.toFixed(0)} contra ${money ? fmtBRL(old) : old.toFixed(0)} no período anterior.`,
      positive: d >= 0,
    });
  };
  push("Sua comissão", commissionTotal, prevCommission);
  push("Seu faturamento", revenue, prevRevenue);
  push("Seu ticket médio", avgTicket, prevAvgTicket);
  push("Venda de produtos", productRevenue, prevProductRevenue);
  push("Seus atendimentos", servicesCount, prevAppts.length, false);

  // Badges --------------------------------------------------------------
  const topRevenue = [...ranking].sort((a, b) => b.revenue - a.revenue)[0];
  const streak = (() => {
    const days = new Set(appts.map((a) => day(a.completed_at || a.start_time)));
    let best = 0;
    let cur = 0;
    const d = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    while (d <= end) {
      if (days.has(d.toISOString().slice(0, 10))) {
        cur += 1;
        best = Math.max(best, cur);
      } else cur = 0;
      d.setDate(d.getDate() + 1);
    }
    return best;
  })();

  const badges = [
    {
      icon: "🏆",
      label: "Maior faturamento do mês",
      earned:
        barberId !== "all" && topRevenue?.id === barberId && revenue > 0,
      hint: topRevenue ? `Líder atual: ${topRevenue.name}` : "Sem dados",
    },
    {
      icon: "💈",
      label: "Especialista em Barba",
      earned: byService.some(
        (s) => /barba/i.test(s.name) && s.count >= 10,
      ),
      hint: "10+ serviços de barba no período",
    },
    {
      icon: "⭐",
      label: "Atendimento Nota 5",
      earned: avgRating >= 4.8 && ratingValues.length >= 3,
      hint: avgRating ? `Média ${avgRating.toFixed(2)}` : "Sem avaliações",
    },
    {
      icon: "🔥",
      label: "30 dias consecutivos atendendo",
      earned: streak >= 30,
      hint: `Sequência atual: ${streak} dia(s)`,
    },
    {
      icon: "💎",
      label: "Ticket Médio Premium",
      earned: avgTicket >= 100,
      hint: `Ticket ${fmtBRL(avgTicket)}`,
    },
    {
      icon: "🚀",
      label: "Campeão de Produtos",
      earned: productUnits >= 20,
      hint: `${productUnits} unidades vendidas`,
    },
  ];

  return {
    hero: {
      commissionTotal,
      commissionPaid,
      commissionPending,
      revenue,
      avgTicket,
      servicesCount,
      productUnits,
      productRevenue,
    },
    cards: {
      day: buckets.day,
      week: buckets.week,
      month: buckets.month,
      revenue,
      revenueDelta: delta(revenue, prevRevenue),
      commissionDelta: delta(commissionTotal, prevCommission),
      productRevenue,
      productDelta: delta(productRevenue, prevProductRevenue),
      servicesCount,
      servicesDelta: delta(servicesCount, prevAppts.length),
      avgTicket,
      avgTicketDelta: delta(avgTicket, prevAvgTicket),
      avgRating,
      ratingCount: ratingValues.length,
    },
    kpis: {
      revenuePerService: avgTicket,
      revenuePerHour,
      revenuePerCustomer: uniqueCustomers ? revenue / uniqueCustomers : 0,
      avgCommission: entries.length ? commissionTotal / entries.length : 0,
      avgTicket,
      productsPerService: servicesCount ? productUnits / servicesCount : 0,
      uniqueCustomers,
      workedHours: workedMinutes / 60,
    },
    series: { daily: dailySeries, weekly: weeklySeries, monthly: monthlySeries },
    byService,
    byProduct,
    byWeekday,
    byHour,
    byPayment,
    byCustomer,
    heat,
    heatMax,
    timeline,
    ranking,
    forecast,
    insights,
    analyses,
    badges,
    commissionRatio,
    prevRange: prev,
  };
}

export type PerfModel = ReturnType<typeof buildPerf>;
export { WEEKDAYS };
