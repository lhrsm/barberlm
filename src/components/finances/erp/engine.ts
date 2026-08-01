/**
 * Motor de cálculo do Centro Financeiro Inteligente.
 * 100% puro e derivado dos dados já existentes — nenhuma regra financeira
 * do Barbex é alterada aqui; apenas agregamos e apresentamos.
 */

export const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pct = (v: number) => `${(Number(v) || 0).toFixed(1)}%`;

const num = (v: any) => Number(v) || 0;

export function variation(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const EXPENSE_TYPES = new Set(["expense"]);

export function isIncome(t: any) {
  return t?.type === "income";
}
export function isExpense(t: any) {
  return EXPENSE_TYPES.has(t?.type);
}

export interface ErpTotals {
  income: number;
  expense: number;
  result: number;
  discounts: number;
  cashbackGranted: number;
  cashbackUsed: number;
  creditsGranted: number;
  creditsUsed: number;
  productsRevenue: number;
  servicesRevenue: number;
  tips: number;
  commissionsTotal: number;
  commissionsPaid: number;
  commissionsPending: number;
  subscriptionsRevenue: number;
  ticketAverage: number;
  servedCount: number;
  couponsUsed: number;
  couponsDiscount: number;
}

export function computeTotals(d: {
  transactions: any[];
  appointments: any[];
  commissions: any[];
  productSales: any[];
  cashback: any[];
  credits: any[];
  subscriptions: any[];
}): ErpTotals {
  const income = d.transactions.filter(isIncome).reduce((a, t) => a + num(t.amount), 0);
  const expense = d.transactions.filter(isExpense).reduce((a, t) => a + num(t.amount), 0);

  const completed = d.appointments.filter((a) => a.status === "completed");
  const discounts = completed.reduce((a, x) => a + num(x.discount_amount), 0);
  const tips = completed.reduce((a, x) => a + num(x.tip_amount), 0);

  const productsRevenue = d.productSales
    .filter((s) => s.status === "completed")
    .reduce((a, s) => a + num(s.total_amount), 0);

  const servicesRevenue = completed.reduce(
    (a, x) => a + (num(x.final_amount) || num(x.total_price)) - num(x.products_amount),
    0,
  );

  const cashbackGranted = d.cashback
    .filter((c) => String(c.type).includes("earn") || String(c.type).includes("credit"))
    .reduce((a, c) => a + num(c.amount), 0);
  const cashbackUsed = d.cashback
    .filter((c) => String(c.type).includes("redeem") || String(c.type).includes("use") || String(c.type).includes("debit"))
    .reduce((a, c) => a + Math.abs(num(c.amount)), 0);

  const creditsGranted = d.credits
    .filter((c) => num(c.amount) > 0)
    .reduce((a, c) => a + num(c.amount), 0);
  const creditsUsed = d.credits
    .filter((c) => num(c.amount) < 0)
    .reduce((a, c) => a + Math.abs(num(c.amount)), 0);

  const commissionsTotal = d.commissions.reduce((a, c) => a + num(c.commission_amount), 0);
  const commissionsPaid = d.commissions
    .filter((c) => c.status === "paid")
    .reduce((a, c) => a + num(c.commission_amount), 0);

  const subscriptionsRevenue = d.subscriptions
    .filter((s) => s.status === "active")
    .reduce((a, s) => a + num(s.amount), 0);

  const servedCount = completed.length;
  const withCoupon = completed.filter((a) => !!a.coupon_code);

  return {
    income,
    expense,
    result: income - expense,
    discounts,
    cashbackGranted,
    cashbackUsed,
    creditsGranted,
    creditsUsed,
    productsRevenue,
    servicesRevenue,
    tips,
    commissionsTotal,
    commissionsPaid,
    commissionsPending: commissionsTotal - commissionsPaid,
    subscriptionsRevenue,
    ticketAverage: servedCount ? servicesRevenue / servedCount : 0,
    servedCount,
    couponsUsed: withCoupon.length,
    couponsDiscount: withCoupon.reduce((a, x) => a + num(x.discount_amount), 0),
  };
}

/** DRE simplificada — usa somente valores já registrados no sistema. */
export function computeDre(t: ErpTotals) {
  const grossRevenue = t.income;
  const netRevenue = grossRevenue - t.discounts;
  const costs = t.commissionsTotal;
  const operatingProfit = netRevenue - costs - t.expense;
  const netProfit = operatingProfit - t.cashbackGranted;
  return {
    grossRevenue,
    discounts: t.discounts,
    cashbackGranted: t.cashbackGranted,
    creditsUsed: t.creditsUsed,
    netRevenue,
    costs,
    expenses: t.expense,
    operatingProfit,
    netProfit,
    margin: grossRevenue ? (netProfit / grossRevenue) * 100 : 0,
  };
}

export interface DaySeriesPoint {
  date: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
  accumulated: number;
}

export function dailySeries(transactions: any[], range: { start: Date | null; end: Date | null }): DaySeriesPoint[] {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    const day = String(t.date || t.created_at || "").slice(0, 10);
    if (!day) continue;
    const cur = map.get(day) || { income: 0, expense: 0 };
    if (isIncome(t)) cur.income += num(t.amount);
    else if (isExpense(t)) cur.expense += num(t.amount);
    map.set(day, cur);
  }

  let days: string[] = [];
  if (range.start && range.end) {
    const d = new Date(range.start);
    while (d <= range.end && days.length < 400) {
      days.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  } else {
    days = [...map.keys()].sort();
  }

  let acc = 0;
  return days.map((date) => {
    const v = map.get(date) || { income: 0, expense: 0 };
    const balance = v.income - v.expense;
    acc += balance;
    const [y, m, dd] = date.split("-");
    return {
      date,
      label: `${dd}/${m}`,
      income: v.income,
      expense: v.expense,
      balance,
      accumulated: acc,
      _y: y,
    } as DaySeriesPoint;
  });
}

export function monthlySeries(transactions: any[]) {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    const key = String(t.date || t.created_at || "").slice(0, 7);
    if (!key) continue;
    const cur = map.get(key) || { income: 0, expense: 0 };
    if (isIncome(t)) cur.income += num(t.amount);
    else if (isExpense(t)) cur.expense += num(t.amount);
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: key.split("-").reverse().join("/"),
      income: v.income,
      expense: v.expense,
      balance: v.income - v.expense,
    }));
}

export interface Breakdown {
  name: string;
  value: number;
  count: number;
}

function group(rows: any[], keyFn: (r: any) => string, valFn: (r: any) => number): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const r of rows) {
    const name = keyFn(r) || "Não informado";
    const cur = map.get(name) || { name, value: 0, count: 0 };
    cur.value += valFn(r);
    cur.count += 1;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  card: "Cartão",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  credits: "Créditos",
  wallet: "Créditos",
  cashback: "Cashback",
  mixed: "Misto",
  misto: "Misto",
  subscription: "Assinatura",
  stripe: "Stripe",
  mercadopago: "Mercado Pago",
};

const ORIGIN_LABEL: Record<string, string> = {
  online: "Agendamento online",
  public: "Agendamento online",
  walkin: "Walk-in",
  walk_in: "Walk-in",
  manual: "Agendamento manual",
  panel: "Agendamento manual",
  admin: "Agendamento manual",
};

export function paymentLabel(v: any) {
  const k = String(v || "").toLowerCase();
  return PAYMENT_LABEL[k] || (k ? k.toUpperCase() : "Não informado");
}

export function originLabel(a: any) {
  const k = String(a?.source || a?.appointment_type || "").toLowerCase();
  if (k.includes("walk")) return "Walk-in";
  return ORIGIN_LABEL[k] || (k ? k : "Não informado");
}

export function breakdowns(d: {
  transactions: any[];
  appointments: any[];
  productSales: any[];
  commissions: any[];
}) {
  const income = d.transactions.filter(isIncome);
  const completed = d.appointments.filter((a) => a.status === "completed");

  const products = new Map<string, Breakdown>();
  for (const sale of d.productSales.filter((s) => s.status === "completed")) {
    const items = Array.isArray(sale.items) ? sale.items : [];
    if (items.length === 0) {
      const cur = products.get("Venda avulsa") || { name: "Venda avulsa", value: 0, count: 0 };
      cur.value += num(sale.total_amount);
      cur.count += 1;
      products.set("Venda avulsa", cur);
      continue;
    }
    for (const it of items) {
      const name = it?.name || it?.product_name || "Produto";
      const qty = num(it?.quantity) || 1;
      const price = num(it?.price ?? it?.unit_price ?? it?.amount);
      const cur = products.get(name) || { name, value: 0, count: 0 };
      cur.value += price * qty;
      cur.count += qty;
      products.set(name, cur);
    }
  }

  return {
    byBarber: group(
      income.filter((t) => t.barber_id),
      (t) => t.barber?.name || "Sem profissional",
      (t) => num(t.amount),
    ),
    byService: group(
      completed,
      (a) => a.services?.name || "Serviço avulso",
      (a) => num(a.final_amount) || num(a.total_price),
    ),
    byPayment: group(
      income,
      (t) => paymentLabel(t.payment_method || t.appointment?.payment_method),
      (t) => num(t.amount),
    ),
    byOrigin: group(completed, (a) => originLabel(a), (a) => num(a.final_amount) || num(a.total_price)),
    byCategory: group(
      d.transactions.filter(isExpense),
      (t) => t.category || "Sem categoria",
      (t) => num(t.amount),
    ),
    byCustomer: group(
      completed.filter((a) => a.customers?.name),
      (a) => a.customers?.name,
      (a) => num(a.final_amount) || num(a.total_price),
    ),
    byProduct: [...products.values()].sort((a, b) => b.value - a.value),
    byWeekday: (() => {
      const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      return group(
        completed.filter((a) => a.start_time),
        (a) => names[new Date(a.start_time).getDay()],
        (a) => num(a.final_amount) || num(a.total_price),
      );
    })(),
    byHour: (() => {
      return group(
        completed.filter((a) => a.start_time),
        (a) => `${String(new Date(a.start_time).getHours()).padStart(2, "0")}h`,
        (a) => num(a.final_amount) || num(a.total_price),
      ).sort((a, b) => a.name.localeCompare(b.name));
    })(),
  };
}

export interface Kpi {
  key: string;
  label: string;
  value: string;
  hint: string;
}

export function computeKpis(t: ErpTotals, d: { appointments: any[]; barbersCount: number }): Kpi[] {
  const completed = d.appointments.filter((a) => a.status === "completed");
  const customers = new Set(completed.map((a) => a.customer_id).filter(Boolean));
  const hours = new Set(
    completed.filter((a) => a.start_time).map((a) => new Date(a.start_time).toISOString().slice(0, 13)),
  );
  return [
    { key: "ticket", label: "Ticket médio", value: brl(t.ticketAverage), hint: "Receita de serviços ÷ atendimentos concluídos" },
    {
      key: "profit-avg",
      label: "Lucro médio por atendimento",
      value: brl(t.servedCount ? t.result / t.servedCount : 0),
      hint: "Resultado do período ÷ atendimentos concluídos",
    },
    {
      key: "revenue-customer",
      label: "Receita por cliente",
      value: brl(customers.size ? t.servicesRevenue / customers.size : 0),
      hint: `${customers.size} cliente(s) atendido(s) no período`,
    },
    {
      key: "revenue-appt",
      label: "Receita por atendimento",
      value: brl(t.servedCount ? (t.servicesRevenue + t.productsRevenue) / t.servedCount : 0),
      hint: "Serviços + produtos ÷ atendimentos",
    },
    {
      key: "revenue-hour",
      label: "Receita por hora ocupada",
      value: brl(hours.size ? t.servicesRevenue / hours.size : 0),
      hint: `${hours.size} hora(s) com atendimento`,
    },
    {
      key: "revenue-barber",
      label: "Receita por profissional",
      value: brl(d.barbersCount ? t.servicesRevenue / d.barbersCount : 0),
      hint: `${d.barbersCount} profissional(is) ativo(s)`,
    },
    {
      key: "products-share",
      label: "Participação de produtos",
      value: pct(
        t.servicesRevenue + t.productsRevenue
          ? (t.productsRevenue / (t.servicesRevenue + t.productsRevenue)) * 100
          : 0,
      ),
      hint: "Produtos sobre a receita total de venda",
    },
    {
      key: "commission-share",
      label: "Comissões sobre receita",
      value: pct(t.income ? (t.commissionsTotal / t.income) * 100 : 0),
      hint: "Custo de comissões em relação às entradas",
    },
  ];
}

/** Saúde financeira 0-100 — regras objetivas, sem IA. */
export function healthScore(args: {
  totals: ErpTotals;
  previous: ErpTotals | null;
  pendingPayments: number;
  activeSubscriptions: number;
  totalCustomers: number;
}) {
  const { totals, previous, pendingPayments, activeSubscriptions, totalCustomers } = args;
  const criteria: { label: string; points: number; max: number; detail: string }[] = [];

  // 1. Resultado positivo (25)
  const positive = totals.result > 0;
  criteria.push({
    label: "Fluxo de caixa positivo",
    points: positive ? 25 : totals.result === 0 ? 12 : 0,
    max: 25,
    detail: brl(totals.result),
  });

  // 2. Crescimento de receita (20)
  const growth = previous ? variation(totals.income, previous.income) : null;
  const growthPoints = growth === null ? 10 : growth >= 10 ? 20 : growth >= 0 ? 15 : growth >= -10 ? 8 : 0;
  criteria.push({
    label: "Crescimento de receita",
    points: growthPoints,
    max: 20,
    detail: growth === null ? "Sem base comparativa" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs período anterior`,
  });

  // 3. Margem líquida (20)
  const margin = totals.income ? ((totals.income - totals.expense - totals.commissionsTotal) / totals.income) * 100 : 0;
  const marginPoints = margin >= 40 ? 20 : margin >= 25 ? 15 : margin >= 10 ? 10 : margin > 0 ? 5 : 0;
  criteria.push({ label: "Margem operacional", points: marginPoints, max: 20, detail: pct(margin) });

  // 4. Inadimplência / pendências (15)
  const pendingRate = totals.income ? (pendingPayments / totals.income) * 100 : pendingPayments > 0 ? 100 : 0;
  const pendingPoints = pendingRate <= 2 ? 15 : pendingRate <= 5 ? 11 : pendingRate <= 15 ? 6 : 0;
  criteria.push({
    label: "Baixa inadimplência",
    points: pendingPoints,
    max: 15,
    detail: `${brl(pendingPayments)} pendentes`,
  });

  // 5. Recorrência (10)
  const recurrenceRate = totalCustomers ? (activeSubscriptions / totalCustomers) * 100 : 0;
  const recurrencePoints = recurrenceRate >= 20 ? 10 : recurrenceRate >= 10 ? 7 : recurrenceRate > 0 ? 4 : 0;
  criteria.push({
    label: "Receita recorrente",
    points: recurrencePoints,
    max: 10,
    detail: `${activeSubscriptions} assinatura(s) ativa(s)`,
  });

  // 6. Comissões sob controle (10)
  const commissionRate = totals.income ? (totals.commissionsTotal / totals.income) * 100 : 0;
  const commissionPoints = commissionRate <= 40 ? 10 : commissionRate <= 55 ? 6 : commissionRate <= 70 ? 3 : 0;
  criteria.push({
    label: "Comissões equilibradas",
    points: commissionPoints,
    max: 10,
    detail: pct(commissionRate),
  });

  const score = Math.max(0, Math.min(100, Math.round(criteria.reduce((a, c) => a + c.points, 0))));
  const level = score >= 80 ? "Excelente" : score >= 60 ? "Saudável" : score >= 40 ? "Atenção" : "Crítico";
  return { score, level, criteria };
}

/** Projeção linear simples baseada no ritmo diário do período em curso. */
export function forecast(series: DaySeriesPoint[], range: { start: Date | null; end: Date | null }) {
  const withData = series.filter((p) => p.income > 0 || p.expense > 0);
  if (withData.length === 0) return null;
  const elapsedDays = Math.max(1, series.length);
  const totalIncome = series.reduce((a, p) => a + p.income, 0);
  const totalExpense = series.reduce((a, p) => a + p.expense, 0);
  const dailyIncome = totalIncome / elapsedDays;
  const dailyExpense = totalExpense / elapsedDays;

  const now = range.end || new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remaining = Math.max(0, daysInMonth - now.getDate());

  return {
    dailyIncome,
    dailyExpense,
    remainingDays: remaining,
    projectedIncome: totalIncome + dailyIncome * remaining,
    projectedExpense: totalExpense + dailyExpense * remaining,
    projectedResult: totalIncome - totalExpense + (dailyIncome - dailyExpense) * remaining,
  };
}

export interface Insight {
  tone: "positive" | "negative" | "neutral";
  title: string;
  description: string;
}

export function buildInsights(args: {
  totals: ErpTotals;
  previous: ErpTotals | null;
  bd: ReturnType<typeof breakdowns>;
}): Insight[] {
  const { totals, previous, bd } = args;
  const out: Insight[] = [];

  const incomeVar = previous ? variation(totals.income, previous.income) : null;
  if (incomeVar !== null) {
    out.push({
      tone: incomeVar >= 0 ? "positive" : "negative",
      title: `Seu faturamento ${incomeVar >= 0 ? "aumentou" : "caiu"} ${Math.abs(incomeVar).toFixed(1)}%`,
      description: `De ${brl(previous!.income)} para ${brl(totals.income)} em relação ao período anterior.`,
    });
  }

  const ticketVar = previous ? variation(totals.ticketAverage, previous.ticketAverage) : null;
  if (ticketVar !== null) {
    out.push({
      tone: ticketVar >= 0 ? "positive" : "negative",
      title: `Seu ticket médio ${ticketVar >= 0 ? "subiu" : "caiu"} ${Math.abs(ticketVar).toFixed(1)}%`,
      description: `Hoje está em ${brl(totals.ticketAverage)} por atendimento concluído.`,
    });
  }

  const totalSale = totals.servicesRevenue + totals.productsRevenue;
  if (totalSale > 0) {
    const prodShare = (totals.productsRevenue / totalSale) * 100;
    out.push({
      tone: "neutral",
      title: `Produtos representam ${prodShare.toFixed(0)}% da receita`,
      description: `Serviços representam ${(100 - prodShare).toFixed(0)}% — ${brl(totals.servicesRevenue)} em serviços e ${brl(totals.productsRevenue)} em produtos.`,
    });
  }

  if (totals.commissionsPending > 0) {
    out.push({
      tone: "negative",
      title: `${brl(totals.commissionsPending)} em comissões pendentes`,
      description: "Existem comissões calculadas e ainda não pagas no período.",
    });
  }

  if (bd.byPayment[0]) {
    out.push({
      tone: "neutral",
      title: `${bd.byPayment[0].name} é a forma de pagamento mais usada`,
      description: `${brl(bd.byPayment[0].value)} recebidos em ${bd.byPayment[0].count} lançamentos.`,
    });
  }

  if (totals.cashbackGranted > 0) {
    out.push({
      tone: totals.cashbackGranted > totals.income * 0.1 ? "negative" : "neutral",
      title: `Cashback concedido de ${brl(totals.cashbackGranted)}`,
      description: `Equivale a ${pct(totals.income ? (totals.cashbackGranted / totals.income) * 100 : 0)} das entradas do período.`,
    });
  }

  if (totals.expense > totals.income && totals.income > 0) {
    out.push({
      tone: "negative",
      title: "Despesas acima das receitas",
      description: `Saídas de ${brl(totals.expense)} contra entradas de ${brl(totals.income)}.`,
    });
  }

  return out;
}

/** Centro Financeiro Inteligente — destaques automáticos. */
export function highlights(args: {
  bd: ReturnType<typeof breakdowns>;
  series: DaySeriesPoint[];
  totals: ErpTotals;
}) {
  const { bd, series, totals } = args;
  const bestDay = [...series].sort((a, b) => b.income - a.income)[0] || null;
  return [
    { label: "Maior receita do período", value: bestDay ? brl(bestDay.income) : "—", detail: bestDay ? bestDay.label : "Sem dados" },
    { label: "Melhor dia da semana", value: bd.byWeekday[0]?.name || "—", detail: bd.byWeekday[0] ? brl(bd.byWeekday[0].value) : "Sem dados" },
    { label: "Melhor horário", value: bd.byHour.slice().sort((a, b) => b.value - a.value)[0]?.name || "—", detail: bd.byHour.length ? brl(bd.byHour.slice().sort((a, b) => b.value - a.value)[0].value) : "Sem dados" },
    { label: "Serviço mais lucrativo", value: bd.byService[0]?.name || "—", detail: bd.byService[0] ? brl(bd.byService[0].value) : "Sem dados" },
    { label: "Produto mais lucrativo", value: bd.byProduct[0]?.name || "—", detail: bd.byProduct[0] ? brl(bd.byProduct[0].value) : "Sem dados" },
    { label: "Profissional que mais faturou", value: bd.byBarber[0]?.name || "—", detail: bd.byBarber[0] ? brl(bd.byBarber[0].value) : "Sem dados" },
    { label: "Cliente com maior ticket", value: bd.byCustomer[0]?.name || "—", detail: bd.byCustomer[0] ? brl(bd.byCustomer[0].value) : "Sem dados" },
    { label: "Pagamento mais utilizado", value: bd.byPayment[0]?.name || "—", detail: bd.byPayment[0] ? brl(bd.byPayment[0].value) : "Sem dados" },
    { label: "Receita recorrente", value: brl(totals.subscriptionsRevenue), detail: "Assinaturas ativas" },
  ];
}

/** Calendário financeiro: agrega por dia entradas/saídas reais + previstas. */
export function calendarData(args: {
  transactions: any[];
  appointments: any[];
  subscriptions: any[];
  month: Date;
}) {
  const { transactions, appointments, subscriptions, month } = args;
  const y = month.getFullYear();
  const m = month.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const key = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const out = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    date: key(i + 1),
    income: 0,
    expense: 0,
    expectedIncome: 0,
    renewals: 0,
  }));
  const byDate = new Map(out.map((o) => [o.date, o]));

  for (const t of transactions) {
    const d = byDate.get(String(t.date || "").slice(0, 10));
    if (!d) continue;
    if (isIncome(t)) d.income += num(t.amount);
    else if (isExpense(t)) d.expense += num(t.amount);
  }

  for (const a of appointments) {
    if (a.payment_status === "pending" && a.status !== "cancelled" && a.start_time) {
      const d = byDate.get(String(a.start_time).slice(0, 10));
      if (d) d.expectedIncome += num(a.final_amount) || num(a.total_price);
    }
  }

  for (const s of subscriptions) {
    if (s.status !== "active") continue;
    const ref = s.next_billing_at || s.renewal_date || s.current_period_end;
    if (!ref) continue;
    const d = byDate.get(String(ref).slice(0, 10));
    if (d) {
      d.renewals += 1;
      d.expectedIncome += num(s.amount);
    }
  }

  return out;
}

export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";"),
    )
    .join("\n");
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
