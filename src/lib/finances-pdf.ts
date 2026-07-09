import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ReportPeriod = "today" | "7d" | "30d" | "month" | "prev_month" | "90d" | "year" | "all";

export const periodLabel: Record<ReportPeriod, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Este mês",
  prev_month: "Mês anterior",
  "90d": "Últimos 90 dias",
  year: "Este ano",
  all: "Todo o período",
};

export function periodRange(p: ReportPeriod): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (p) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "7d": return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d": return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "month": return { start: startOfMonth(now), end: endOfDay(now) };
    case "prev_month": {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "90d": return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    case "year": return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
    case "all": return { start: null, end: null };
  }
}

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export async function exportFinancesPdf(opts: {
  tenantId: string;
  period: ReportPeriod;
  businessName?: string;
}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const { start, end } = periodRange(opts.period);
  const startIso = start?.toISOString();
  const endIso = end?.toISOString();

  const buildRange = (col: string) => {
    const filters: string[] = [];
    if (startIso) filters.push(`gte:${col}:${startIso}`);
    if (endIso) filters.push(`lte:${col}:${endIso}`);
    return filters;
  };

  // Appointments
  let apptQ = supabase
    .from("appointments")
    .select("id, start_time, total_price, discount_amount, coupon_code, coupon_id, payment_method, status, barber_id, service_id")
    .eq("tenant_id", opts.tenantId);
  if (startIso) apptQ = apptQ.gte("start_time", startIso);
  if (endIso) apptQ = apptQ.lte("start_time", endIso);
  const { data: appts = [] } = await apptQ;

  // Subscription payments
  let subQ = supabase
    .from("subscription_payments")
    .select("amount, paid_at, status")
    .eq("tenant_id", opts.tenantId);
  if (startIso) subQ = subQ.gte("paid_at", startIso);
  if (endIso) subQ = subQ.lte("paid_at", endIso);
  const { data: subs = [] } = await subQ;

  // Product sales
  let prodQ = supabase
    .from("product_sales")
    .select("total_amount, sold_at")
    .eq("tenant_id", opts.tenantId);
  if (startIso) prodQ = prodQ.gte("sold_at", startIso);
  if (endIso) prodQ = prodQ.lte("sold_at", endIso);
  const { data: prods = [] } = await prodQ;

  // Cashback
  let cashQ = supabase
    .from("cashback_transactions")
    .select("amount, type, created_at")
    .eq("tenant_id", opts.tenantId);
  if (startIso) cashQ = cashQ.gte("created_at", startIso);
  if (endIso) cashQ = cashQ.lte("created_at", endIso);
  const { data: cashRows = [] } = await cashQ;

  // Credits
  let credQ = supabase
    .from("credit_transactions")
    .select("amount, type, created_at")
    .eq("tenant_id", opts.tenantId);
  if (startIso) credQ = credQ.gte("created_at", startIso);
  if (endIso) credQ = credQ.lte("created_at", endIso);
  const { data: credRows = [] } = await credQ;

  // Aggregations
  const svcRevenue = (appts as any[])
    .filter((a) => a.status === "completed")
    .reduce((s, a) => s + Number(a.total_price || 0), 0);
  const subRevenue = (subs as any[])
    .filter((s: any) => s.status === "paid" || s.status === "completed")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const prodRevenue = (prods as any[]).reduce((s, r) => s + Number(r.total_amount || 0), 0);

  const cashbackGranted = (cashRows as any[])
    .filter((r) => r.type === "earned" || r.type === "credit")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const cashbackUsed = (cashRows as any[])
    .filter((r) => r.type === "used" || r.type === "debit" || r.type === "redeemed")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const creditsGranted = (credRows as any[])
    .filter((r) => r.type === "credit" || r.type === "earned")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const creditsUsed = (credRows as any[])
    .filter((r) => r.type === "used" || r.type === "debit")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const couponDiscount = (appts as any[]).reduce((s, a) => s + Number(a.discount_amount || 0), 0);
  const couponUses = (appts as any[]).filter((a) => a.coupon_id).length;

  const gross = svcRevenue + subRevenue + prodRevenue;
  const net = gross - couponDiscount - cashbackUsed - creditsUsed;

  // Payment method breakdown
  const byMethod = new Map<string, number>();
  for (const a of appts as any[]) {
    if (a.status !== "completed") continue;
    const k = a.payment_method || "não informado";
    byMethod.set(k, (byMethod.get(k) || 0) + Number(a.total_price || 0));
  }

  // Top coupons
  const byCoupon = new Map<string, { code: string; uses: number; discount: number }>();
  for (const a of appts as any[]) {
    if (!a.coupon_id) continue;
    const key = a.coupon_code || a.coupon_id;
    const cur = byCoupon.get(key) ?? { code: a.coupon_code || "—", uses: 0, discount: 0 };
    cur.uses += 1;
    cur.discount += Number(a.discount_amount || 0);
    byCoupon.set(key, cur);
  }
  const topCoupons = [...byCoupon.values()].sort((a, b) => b.discount - a.discount).slice(0, 10);

  // Build PDF
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Header
  doc.setFillColor(10, 16, 32);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Relatório Financeiro", marginX, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.businessName || "Barbex", marginX, 60);
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  const now = new Date();
  doc.text(
    `Período: ${periodLabel[opts.period]} • Gerado em ${format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    marginX,
    76,
  );

  // KPIs box
  let y = 110;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo Executivo", marginX, y);
  y += 8;

  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [10, 16, 32], textColor: [212, 175, 55], fontStyle: "bold" },
    head: [["Indicador", "Valor"]],
    body: [
      ["Receita bruta", brl(gross)],
      ["Receita de serviços", brl(svcRevenue)],
      ["Receita de assinaturas", brl(subRevenue)],
      ["Receita de produtos", brl(prodRevenue)],
      ["Descontos com cupons", brl(couponDiscount)],
      ["Cashback concedido / utilizado", `${brl(cashbackGranted)} / ${brl(cashbackUsed)}`],
      ["Créditos concedidos / utilizados", `${brl(creditsGranted)} / ${brl(creditsUsed)}`],
      ["Receita líquida", brl(net)],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 24;

  // Payment methods
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Receita por Forma de Pagamento", marginX, y);
  autoTable(doc, {
    startY: y + 6,
    theme: "striped",
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [10, 16, 32], textColor: [212, 175, 55] },
    head: [["Método", "Total"]],
    body: [...byMethod.entries()].map(([k, v]) => [k, brl(v)]),
  });

  y = (doc as any).lastAutoTable.finalY + 24;

  // Top coupons
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Top Cupons no Período", marginX, y);
  autoTable(doc, {
    startY: y + 6,
    theme: "striped",
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [10, 16, 32], textColor: [212, 175, 55] },
    head: [["Cupom", "Usos", "Desconto"]],
    body: topCoupons.length
      ? topCoupons.map((c) => [c.code, String(c.uses), brl(c.discount)])
      : [["Nenhum cupom utilizado", "-", "-"]],
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Barbex — Relatório Financeiro • Página ${i} de ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  const fname = `barbex-financeiro-${opts.period}-${format(now, "yyyyMMdd-HHmm")}.pdf`;
  doc.save(fname);
  return fname;
}
