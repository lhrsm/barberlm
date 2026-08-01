/**
 * Pure calculation engine for the Commercial Center.
 * No side effects, no queries, no writes.
 */

export type SaleItem = {
  productId: string | null;
  name: string;
  price: number;
  quantity: number;
  total: number;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function parseItems(raw: any): SaleItem[] {
  let items: any = raw;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) items = items ? [items] : [];
  return items.map((it: any) => {
    const price = Number(it?.price ?? it?.unit_price ?? 0);
    const quantity = Number(it?.quantity ?? it?.qty ?? 1);
    return {
      productId: it?.product_id ?? it?.productId ?? it?.id ?? null,
      name: String(it?.name ?? it?.product_name ?? "Produto"),
      price,
      quantity,
      total: Number(it?.total ?? price * quantity),
    };
  });
}

export function validSales(sales: any[]) {
  return (sales || []).filter((s) => s?.status !== "cancelled" && s?.status !== "refunded");
}

export type Flat = SaleItem & { saleId: string; createdAt: Date; customerId: string | null };

export function flatten(sales: any[]): Flat[] {
  const out: Flat[] = [];
  for (const s of validSales(sales)) {
    const created = new Date(s.created_at);
    for (const it of parseItems(s.items)) {
      out.push({ ...it, saleId: s.id, createdAt: created, customerId: s.customer_id ?? null });
    }
  }
  return out;
}

export function computeOverview(sales: any[], products: any[], marginRate = 0.4) {
  const list = validSales(sales);
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let revenueTotal = 0;
  let revenueToday = 0;
  let revenueMonth = 0;
  let revenuePrevMonth = 0;
  let unitsToday = 0;
  let unitsMonth = 0;
  let unitsTotal = 0;

  for (const s of list) {
    const amount = Number(s.total_amount || 0);
    const d = new Date(s.created_at);
    const units = parseItems(s.items).reduce((a, i) => a + i.quantity, 0);
    revenueTotal += amount;
    unitsTotal += units;
    if (d >= today) {
      revenueToday += amount;
      unitsToday += units;
    }
    if (d >= monthStart) {
      revenueMonth += amount;
      unitsMonth += units;
    } else if (d >= prevMonthStart) {
      revenuePrevMonth += amount;
    }
  }

  const orders = list.length;
  const ordersMonth = list.filter((s) => new Date(s.created_at) >= monthStart).length;
  const activeProducts = (products || []).filter((p) => p.active !== false).length;
  const categories = new Set((products || []).map((p) => p.category).filter(Boolean)).size;
  const stockValue = (products || []).reduce(
    (a, p) => a + Number(p.stock_quantity || 0) * Number(p.promotional_price || p.price || 0),
    0,
  );

  return {
    revenueTotal,
    revenueToday,
    revenueMonth,
    revenuePrevMonth,
    monthDelta: revenuePrevMonth > 0 ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : null,
    unitsToday,
    unitsMonth,
    unitsTotal,
    orders,
    ordersMonth,
    avgTicket: orders ? revenueTotal / orders : 0,
    estimatedProfit: revenueTotal * marginRate,
    estimatedProfitMonth: revenueMonth * marginRate,
    marginRate,
    activeProducts,
    categories,
    stockValue,
    itemsPerOrder: orders ? unitsTotal / orders : 0,
  };
}

export function productPerformance(sales: any[], products: any[], marginRate = 0.4) {
  const flat = flatten(sales);
  const byId = new Map<string, { units: number; revenue: number; last: Date | null; name: string }>();
  const byName = new Map<string, string>(); // normalized name -> product id

  for (const p of products || []) {
    byId.set(p.id, { units: 0, revenue: 0, last: null, name: p.name });
    byName.set(String(p.name || "").trim().toLowerCase(), p.id);
  }

  for (const f of flat) {
    const id = f.productId && byId.has(f.productId) ? f.productId : byName.get(f.name.trim().toLowerCase());
    if (!id) continue;
    const agg = byId.get(id)!;
    agg.units += f.quantity;
    agg.revenue += f.total;
    if (!agg.last || f.createdAt > agg.last) agg.last = f.createdAt;
  }

  const now = Date.now();
  return (products || []).map((p) => {
    const agg = byId.get(p.id)!;
    const daysIdle = agg.last ? Math.floor((now - agg.last.getTime()) / 86400000) : null;
    const price = Number(p.promotional_price || p.price || 0);
    return {
      product: p,
      units: agg.units,
      revenue: agg.revenue,
      lastSale: agg.last,
      daysIdle,
      profit: agg.revenue * marginRate,
      stock: Number(p.stock_quantity || 0),
      stockValue: Number(p.stock_quantity || 0) * price,
    };
  });
}

export function categoryBreakdown(perf: ReturnType<typeof productPerformance>) {
  const map = new Map<string, { category: string; revenue: number; units: number; products: number }>();
  for (const row of perf) {
    const cat = row.product.category || "Sem categoria";
    const cur = map.get(cat) || { category: cat, revenue: 0, units: 0, products: 0 };
    cur.revenue += row.revenue;
    cur.units += row.units;
    cur.products += 1;
    map.set(cat, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function revenueSeries(sales: any[], days = 30) {
  const list = validSales(sales);
  const out: { key: string; label: string; revenue: number; units: number }[] = [];
  const base = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    out.push({
      key: d.toISOString().slice(0, 10),
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      revenue: 0,
      units: 0,
    });
  }
  const index = new Map(out.map((o) => [o.key, o]));
  for (const s of list) {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    const bucket = index.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(s.total_amount || 0);
    bucket.units += parseItems(s.items).reduce((a, i) => a + i.quantity, 0);
  }
  return out;
}

export function monthlySeries(sales: any[], months = 12) {
  const list = validSales(sales);
  const out: { key: string; label: string; revenue: number; orders: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      revenue: 0,
      orders: 0,
    });
  }
  const index = new Map(out.map((o) => [o.key, o]));
  for (const s of list) {
    const d = new Date(s.created_at);
    const bucket = index.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    if (!bucket) continue;
    bucket.revenue += Number(s.total_amount || 0);
    bucket.orders += 1;
  }
  return out;
}

export function topCustomers(sales: any[], customers: any[], limit = 8) {
  const list = validSales(sales);
  const nameById = new Map((customers || []).map((c) => [c.id, c.name]));
  const map = new Map<string, { id: string; name: string; spent: number; orders: number; last: Date | null; favorite: string }>();
  const favCount = new Map<string, Map<string, number>>();

  for (const s of list) {
    const id = s.customer_id;
    if (!id) continue;
    const cur = map.get(id) || {
      id,
      name: nameById.get(id) || "Cliente",
      spent: 0,
      orders: 0,
      last: null,
      favorite: "—",
    };
    cur.spent += Number(s.total_amount || 0);
    cur.orders += 1;
    const d = new Date(s.created_at);
    if (!cur.last || d > cur.last) cur.last = d;
    map.set(id, cur);

    const fav = favCount.get(id) || new Map<string, number>();
    for (const it of parseItems(s.items)) fav.set(it.name, (fav.get(it.name) || 0) + it.quantity);
    favCount.set(id, fav);
  }

  for (const [id, entry] of map) {
    const fav = favCount.get(id);
    if (fav && fav.size) {
      entry.favorite = Array.from(fav.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, limit);
}

/** "Clientes também compraram" — pares de produtos comprados no mesmo pedido. */
export function crossSellPairs(sales: any[], limit = 8) {
  const map = new Map<string, { a: string; b: string; count: number }>();
  for (const s of validSales(sales)) {
    const names = Array.from(new Set(parseItems(s.items).map((i) => i.name)));
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const [a, b] = [names[i], names[j]].sort();
        const key = `${a}||${b}`;
        const cur = map.get(key) || { a, b, count: 0 };
        cur.count += 1;
        map.set(key, cur);
      }
    }
  }
  return Array.from(map.values())
    .sort((x, y) => y.count - x.count)
    .slice(0, limit);
}

export type Opportunity = {
  id: string;
  tone: "danger" | "warning" | "success" | "info";
  title: string;
  description: string;
};

export function opportunities(
  perf: ReturnType<typeof productPerformance>,
  cats: ReturnType<typeof categoryBreakdown>,
  minStock = 3,
): Opportunity[] {
  const out: Opportunity[] = [];
  const money = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

  const critical = perf.filter((r) => r.product.active !== false && r.stock <= minStock);
  for (const r of critical.slice(0, 4)) {
    out.push({
      id: `stock-${r.product.id}`,
      tone: r.stock === 0 ? "danger" : "warning",
      title: r.stock === 0 ? `${r.product.name} sem estoque` : `${r.product.name} com estoque crítico`,
      description: r.stock === 0 ? "Produto indisponível na loja. Reponha para não perder vendas." : `Restam ${r.stock} unidades. Programe a reposição.`,
    });
  }

  const idle = perf
    .filter((r) => r.product.active !== false && (r.daysIdle === null || r.daysIdle >= 30))
    .sort((a, b) => (b.daysIdle ?? 999) - (a.daysIdle ?? 999));
  for (const r of idle.slice(0, 3)) {
    out.push({
      id: `idle-${r.product.id}`,
      tone: "info",
      title: `${r.product.name} sem vendas`,
      description: r.daysIdle === null ? "Nunca foi vendido. Avalie destacar na loja ou criar promoção." : `Sem vendas há ${r.daysIdle} dias. Considere promoção ou destaque.`,
    });
  }

  const champions = [...perf].sort((a, b) => b.revenue - a.revenue).filter((r) => r.revenue > 0);
  if (champions[0]) {
    out.push({
      id: `champ-${champions[0].product.id}`,
      tone: "success",
      title: `${champions[0].product.name} é campeão de vendas`,
      description: `${champions[0].units} unidades e ${money(champions[0].revenue)} em receita. Mantenha o estoque em dia.`,
    });
  }

  if (cats[0]) {
    out.push({
      id: `cat-${cats[0].category}`,
      tone: "success",
      title: `Categoria ${cats[0].category} lidera`,
      description: `${money(cats[0].revenue)} em receita com ${cats[0].units} unidades vendidas.`,
    });
  }

  return out;
}

export function couponInsights(coupons: any[]) {
  const list = coupons || [];
  const now = Date.now();
  const active = list.filter(
    (c) => c.active !== false && (!c.expires_at || new Date(c.expires_at).getTime() > now),
  );
  const used = list.reduce((a, c) => a + Number(c.used_count || 0), 0);
  const capacity = list.reduce((a, c) => a + Number(c.usage_limit || 0), 0);
  return {
    total: list.length,
    active: active.length,
    used,
    conversion: capacity ? (used / capacity) * 100 : null,
    top: [...list].sort((a, b) => Number(b.used_count || 0) - Number(a.used_count || 0)).slice(0, 6),
  };
}

export function cashbackInsights(cashback: any[]) {
  const list = cashback || [];
  const granted = list
    .filter((t) => Number(t.amount || 0) > 0 || String(t.type).includes("earn") || String(t.type).includes("credit"))
    .reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0);
  const spent = list
    .filter((t) => Number(t.amount || 0) < 0 || String(t.type).includes("use") || String(t.type).includes("redeem") || String(t.type).includes("debit"))
    .reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0);
  return { granted, spent, balanceRate: granted ? (spent / granted) * 100 : 0, count: list.length };
}
