import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CustomerCrmData } from "./useCustomerCrm";

export function formatBRL(v: any) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

export function initials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? parseISO(v) : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function mostFrequent(list: (string | undefined | null)[]) {
  const map = new Map<string, number>();
  for (const item of list) {
    if (!item) continue;
    map.set(item, (map.get(item) || 0) + 1);
  }
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of map) if (!best || count > best.count) best = { key, count };
  return best;
}

export interface CustomerKpis {
  visits: number;
  completed: number;
  cancelled: number;
  totalSpent: number;
  avgTicket: number;
  daysAsCustomer: number | null;
  avgFrequencyDays: number | null;
  daysSinceLast: number | null;
  favoriteService: { key: string; count: number } | null;
  favoriteBarber: { key: string; count: number } | null;
  favoriteWeekday: string | null;
  favoriteProducts: { name: string; qty: number; total: number; last: Date | null }[];
  productsTotal: number;
  cashbackEarned: number;
  cashbackUsed: number;
  creditsEarned: number;
  creditsUsed: number;
  avgRating: number | null;
  lastVisit: Date | null;
  nextVisit: Date | null;
  monthlySpend: { month: string; value: number }[];
  yearlySpend: { year: string; value: number }[];
  relationshipScore: { label: string; value: number; color: string };
  segments: string[];
  opportunities: { title: string; description: string; type: string }[];
  funnelStage: "Novo" | "Recorrente" | "VIP" | "Em Risco" | "Inativo" | "Recuperado";
}

export function computeKpis(customer: any, history: any[], products: any[], crm: CustomerCrmData, isSub: boolean = false): CustomerKpis {
  const completedList = history.filter((h) => h.status === "completed");
  const cancelled = history.filter((h) => h.status === "cancelled").length;
  const now = new Date();

  const dates = completedList
    .map((h) => toDate(h.start_time))
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime()) as Date[];

  const totalSpent = Number(customer.total_spent || customer.lifetime_value || 0);
  const visits = completedList.length || Number(customer.total_visits || 0);
  const avgTicket = visits > 0 ? totalSpent / visits : 0;

  let avgFrequencyDays: number | null = null;
  if (dates.length >= 2) {
    let sum = 0;
    for (let i = 1; i < dates.length; i++) sum += differenceInDays(dates[i], dates[i - 1]);
    avgFrequencyDays = Math.round(sum / (dates.length - 1));
  }

  const createdAt = toDate(customer.created_at);
  const lastVisit = dates.length ? dates[dates.length - 1] : toDate(customer.last_visit);
  const daysSinceLast = lastVisit ? differenceInDays(now, lastVisit) : null;

  const nextVisit =
    history
      .filter((h) => h.status === "scheduled" && toDate(h.start_time) && toDate(h.start_time)! > now)
      .map((h) => toDate(h.start_time)!)
      .sort((a, b) => a.getTime() - b.getTime())[0] || null;

  // Products aggregation from jsonb items
  const prodMap = new Map<string, { name: string; qty: number; total: number; last: Date | null }>();
  let productsTotal = 0;
  for (const sale of products) {
    productsTotal += Number(sale.total_amount || 0);
    const items = Array.isArray(sale.items) ? sale.items : [];
    for (const it of items) {
      const name = it?.name || it?.product_name || "Produto";
      const qty = Number(it?.quantity ?? it?.qty ?? 1);
      const price = Number(it?.price ?? it?.unit_price ?? 0) * qty;
      const prev = prodMap.get(name) || { name, qty: 0, total: 0, last: null as Date | null };
      const saleDate = toDate(sale.created_at);
      prodMap.set(name, {
        name,
        qty: prev.qty + qty,
        total: prev.total + price,
        last: !prev.last || (saleDate && saleDate > prev.last) ? saleDate : prev.last,
      });
    }
  }

  const cashbackEarned = crm.cashback
    .filter((t) => Number(t.amount) > 0 || String(t.type).includes("earn") || String(t.type).includes("credit"))
    .reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0);
  const cashbackUsed = crm.cashback
    .filter((t) => Number(t.amount) < 0 || String(t.type).includes("use") || String(t.type).includes("redeem") || String(t.type).includes("debit"))
    .reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0);
  const creditsEarned = crm.credits.reduce((a, c) => a + Number(c.amount || 0), 0);
  const creditsUsed = crm.credits.reduce((a, c) => a + Number(c.used_amount || 0), 0);

  const ratings = crm.reviews
    .map((r) => Number(r.barbershop_rating ?? r.service_rating ?? r.barber_rating ?? 0))
    .filter((n) => n > 0);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // Spend series (appointments + products)
  const monthMap = new Map<string, number>();
  const yearMap = new Map<string, number>();
  const addSpend = (d: Date | null, v: number) => {
    if (!d || !v) return;
    const mk = format(d, "MM/yyyy");
    const yk = format(d, "yyyy");
    monthMap.set(mk, (monthMap.get(mk) || 0) + v);
    yearMap.set(yk, (yearMap.get(yk) || 0) + v);
  };
  for (const h of completedList) addSpend(toDate(h.start_time), Number(h.total_price || 0));
  for (const p of products) addSpend(toDate(p.created_at), Number(p.total_amount || 0));

  const monthlySpend = Array.from(monthMap.entries())
    .map(([month, value]) => ({ month, value: Number(value.toFixed(2)) }))
    .sort((a, b) => {
      const [ma, ya] = a.month.split("/");
      const [mb, yb] = b.month.split("/");
      return `${ya}${ma}`.localeCompare(`${yb}${mb}`);
    })
    .slice(-12);
  const yearlySpend = Array.from(yearMap.entries())
    .map(([year, value]) => ({ year, value: Number(value.toFixed(2)) }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Calculate Relationship Score (0-100)
  let score = 0;
  if (completedList.length >= 1) score += 20;
  if (completedList.length >= 5) score += 20;
  if (completedList.length >= 12) score += 20;
  if (isSub) score += 20;
  if (avgRating && avgRating >= 4.5) score += 20;
  if (daysSinceLast !== null && daysSinceLast > 60) score -= 10;

  const getScoreMeta = (s: number) => {
    if (s >= 80) return { label: "Excelente", value: s, color: "text-cyan-400" };
    if (s >= 60) return { label: "Muito Bom", value: s, color: "text-emerald-400" };
    if (s >= 40) return { label: "Bom", value: s, color: "text-gold" };
    if (s >= 20) return { label: "Regular", value: s, color: "text-orange-400" };
    return { label: "Baixo", value: s, color: "text-red-400" };
  };

  // Segments
  const segments: string[] = [];
  if (completedList.length >= 12) segments.push("VIP");
  if (completedList.length >= 3 && daysSinceLast !== null && daysSinceLast < 45) segments.push("Frequente");
  if (completedList.length === 1) segments.push("Novo");
  if (daysSinceLast !== null && daysSinceLast > 45 && daysSinceLast < 90) segments.push("Em risco");
  if (daysSinceLast !== null && daysSinceLast >= 90) segments.push("Inativo");
  if (isSub) segments.push("Assinante");
  if (productsTotal > 0) segments.push("Comprador da Loia");
  if (avgTicket > 100) segments.push("Alto Ticket");

  // Funnel
  let funnelStage: "Novo" | "Recorrente" | "VIP" | "Em Risco" | "Inativo" | "Recuperado" = "Novo";
  if (daysSinceLast !== null && daysSinceLast >= 90) funnelStage = "Inativo";
  else if (daysSinceLast !== null && daysSinceLast >= 45) funnelStage = "Em Risco";
  else if (completedList.length >= 12) funnelStage = "VIP";
  else if (completedList.length >= 3) funnelStage = "Recorrente";

  // Opportunities
  const opportunities: { title: string; description: string; type: string }[] = [];
  if (avgFrequencyDays && daysSinceLast && daysSinceLast > avgFrequencyDays * 1.2) {
    opportunities.push({
      title: "Recuperação",
      description: `Cliente está há ${daysSinceLast} dias sem voltar. A média dele é ${avgFrequencyDays} dias.`,
      type: "churn_risk",
    });
  }
  if (!isSub && completedList.length >= 3) {
    opportunities.push({
      title: "Upgrade de Plano",
      description: "Cliente recorrente ainda não é assinante. Ótimo perfil para o Clube Barbex.",
      type: "upsell",
    });
  }

  return {
    visits,
    completed: completedList.length,
    cancelled,
    totalSpent,
    avgTicket,
    daysAsCustomer: createdAt ? differenceInDays(now, createdAt) : null,
    avgFrequencyDays,
    daysSinceLast,
    favoriteService: mostFrequent(completedList.map((h) => h.services?.name)),
    favoriteBarber: mostFrequent(completedList.map((h) => h.barbers?.name)),
    favoriteWeekday: dates.length
      ? mostFrequent(dates.map((d) => format(d, "EEEE", { locale: ptBR })))?.key || null
      : null,
    favoriteProducts: Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 6),
    productsTotal,
    cashbackEarned: cashbackEarned || Number(customer.cashback_balance || 0) + Number(customer.cashback_used || 0),
    cashbackUsed: cashbackUsed || Number(customer.cashback_used || 0),
    creditsEarned: creditsEarned || Number(customer.credits || 0) + Number(customer.credits_used || 0),
    creditsUsed: creditsUsed || Number(customer.credits_used || 0),
    avgRating,
    lastVisit,
    nextVisit,
    monthlySpend,
    yearlySpend,
    relationshipScore: getScoreMeta(score),
    segments,
    opportunities,
    funnelStage,
  };
}

/** Rule-based (no AI) intelligent profile sentences. */
export function buildSmartProfile(customer: any, kpis: CustomerKpis, isSub: boolean): string[] {
  const out: string[] = [];
  if (kpis.avgFrequencyDays)
    out.push(`Frequenta a barbearia a cada ${kpis.avgFrequencyDays} dias, em média.`);
  if (kpis.favoriteWeekday) out.push(`O melhor dia de retorno costuma ser ${kpis.favoriteWeekday}.`);
  if (kpis.favoriteService) out.push(`O serviço mais contratado é ${kpis.favoriteService.key} (${kpis.favoriteService.count}x).`);
  if (kpis.favoriteBarber) out.push(`O profissional preferido é ${kpis.favoriteBarber.key}.`);
  if (kpis.totalSpent > 0) out.push(`Já investiu ${formatBRL(kpis.totalSpent)} na barbearia.`);
  if (kpis.cashbackUsed > 0) out.push(`Economizou ${formatBRL(kpis.cashbackUsed)} utilizando cashback.`);
  if (kpis.favoriteProducts.length) out.push(`Produto favorito: ${kpis.favoriteProducts[0].name}.`);
  if (kpis.avgRating) out.push(`Avaliação média das experiências: ${kpis.avgRating.toFixed(1)} de 5.`);

  const loyal = isSub || kpis.completed >= 12 || (kpis.avgFrequencyDays !== null && kpis.avgFrequencyDays <= 35);
  if (loyal) out.push("Possui alta fidelização.");
  else if (kpis.completed <= 2) out.push("Cliente em fase inicial de relacionamento.");

  if (kpis.daysSinceLast !== null && kpis.avgFrequencyDays && kpis.daysSinceLast > kpis.avgFrequencyDays * 1.5)
    out.push(`Está ${kpis.daysSinceLast} dias sem retornar — acima do seu próprio padrão. Momento ideal para um contato.`);
  if (kpis.cancelled >= 3) out.push(`Registrou ${kpis.cancelled} cancelamentos no histórico.`);
  return out;
}

export interface TimelineEvent {
  id: string;
  date: Date;
  kind: string;
  title: string;
  description?: string;
  amount?: number;
  tone: "gold" | "emerald" | "blue" | "red" | "slate" | "purple";
}

export function buildTimeline(
  customer: any,
  history: any[],
  products: any[],
  crm: CustomerCrmData,
  subscription: any,
): TimelineEvent[] {
  const ev: TimelineEvent[] = [];
  const push = (e: TimelineEvent | null) => e && ev.push(e);

  const created = toDate(customer.created_at);
  if (created)
    push({ id: `c-${customer.id}`, date: created, kind: "cadastro", title: "Cliente cadastrado", tone: "slate" });

  for (const h of history) {
    const d = toDate(h.start_time);
    if (!d) continue;
    const status = h.status;
    push({
      id: `a-${h.id}`,
      date: d,
      kind: "atendimento",
      title:
        status === "cancelled"
          ? `Cancelamento — ${h.services?.name || "Serviço"}`
          : status === "completed"
            ? `Atendimento — ${h.services?.name || "Serviço"}`
            : `Agendamento — ${h.services?.name || "Serviço"}`,
      description: [h.barbers?.name, h.payment_method].filter(Boolean).join(" • "),
      amount: Number(h.total_price || 0) || undefined,
      tone: status === "cancelled" ? "red" : status === "completed" ? "emerald" : "blue",
    });
  }

  for (const p of products) {
    const d = toDate(p.created_at);
    if (!d) continue;
    const items = Array.isArray(p.items) ? p.items : [];
    push({
      id: `p-${p.id}`,
      date: d,
      kind: "produto",
      title: "Compra de produtos",
      description: items.map((i: any) => i?.name).filter(Boolean).join(", ") || undefined,
      amount: Number(p.total_amount || 0),
      tone: "purple",
    });
  }

  for (const t of crm.cashback) {
    const d = toDate(t.created_at);
    if (!d) continue;
    const positive = Number(t.amount) >= 0 && !String(t.type).match(/use|redeem|debit/);
    push({
      id: `cb-${t.id}`,
      date: d,
      kind: "cashback",
      title: positive ? "Cashback recebido" : "Cashback utilizado",
      description: t.description || undefined,
      amount: Math.abs(Number(t.amount || 0)),
      tone: "gold",
    });
  }

  for (const t of crm.creditTx) {
    const d = toDate(t.created_at);
    if (!d) continue;
    const positive = Number(t.amount) >= 0 && !String(t.type).match(/use|debit|consume/);
    push({
      id: `cr-${t.id}`,
      date: d,
      kind: "credito",
      title: positive ? "Crédito concedido" : "Crédito utilizado",
      description: t.description || undefined,
      amount: Math.abs(Number(t.amount || 0)),
      tone: "emerald",
    });
  }

  for (const r of crm.reviews) {
    const d = toDate(r.submitted_at || r.created_at);
    if (!d) continue;
    push({
      id: `r-${r.id}`,
      date: d,
      kind: "avaliacao",
      title: `Avaliação ${r.barbershop_rating ?? r.service_rating ?? "—"}★`,
      description: r.testimonial_text || undefined,
      tone: "gold",
    });
  }

  for (const a of crm.automations.slice(0, 60)) {
    const d = toDate(a.sent_at || a.created_at);
    if (!d) continue;
    push({
      id: `au-${a.id}`,
      date: d,
      kind: "automacao",
      title: `Mensagem automática — ${a.message_type || "notificação"}`,
      description: [a.direction === "inbound" ? "Resposta do cliente" : "Enviada", a.status].filter(Boolean).join(" • "),
      tone: "blue",
    });
  }

  if (subscription) {
    const d = toDate(subscription.started_at);
    if (d)
      push({
        id: `s-${subscription.id}`,
        date: d,
        kind: "assinatura",
        title: `Assinou o plano ${subscription.subscription_plans?.name || ""}`.trim(),
        tone: "gold",
      });
  }

  return ev.sort((a, b) => b.date.getTime() - a.date.getTime());
}
