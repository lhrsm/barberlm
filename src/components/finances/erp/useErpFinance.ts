import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ErpPeriod =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "prev_month"
  | "90d"
  | "year"
  | "all"
  | "custom";

export interface ErpRange {
  start: Date | null;
  end: Date | null;
  label: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function erpPeriodRange(period: ErpPeriod, customStart?: string, customEnd?: string): ErpRange {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now), label: "Hoje" };
    case "yesterday": {
      const y = addDays(now, -1);
      return { start: startOfDay(y), end: endOfDay(y), label: "Ontem" };
    }
    case "7d":
      return { start: startOfDay(addDays(now, -6)), end: endOfDay(now), label: "Últimos 7 dias" };
    case "30d":
      return { start: startOfDay(addDays(now, -29)), end: endOfDay(now), label: "Últimos 30 dias" };
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: endOfDay(now),
        label: "Este mês",
      };
    case "prev_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
        label: "Mês anterior",
      };
    case "90d":
      return { start: startOfDay(addDays(now, -89)), end: endOfDay(now), label: "Últimos 90 dias" };
    case "year":
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now), label: "Este ano" };
    case "custom":
      return {
        start: customStart ? startOfDay(new Date(customStart + "T00:00:00")) : null,
        end: customEnd ? endOfDay(new Date(customEnd + "T00:00:00")) : null,
        label: "Período personalizado",
      };
    case "all":
    default:
      return { start: null, end: null, label: "Todo o período" };
  }
}

/** Range imediatamente anterior, de mesma duração, para comparativos. */
export function previousRange(range: ErpRange): ErpRange {
  if (!range.start || !range.end) return { start: null, end: null, label: "—" };
  const ms = range.end.getTime() - range.start.getTime();
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - ms);
  return { start, end, label: "Período anterior" };
}

const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const CACHE = { staleTime: 60_000, gcTime: 5 * 60_000 } as const;

/**
 * Camada exclusivamente de leitura. Não altera nenhuma regra de cálculo existente —
 * apenas agrega os dados já produzidos pelo módulo financeiro atual.
 */
export function useErpFinance(tenantId: string | null, range: ErpRange, enabled = true) {
  const key = [tenantId, range.start ? iso(range.start) : "all", range.end ? iso(range.end) : "all"];
  const on = !!tenantId && enabled;

  const transactions = useQuery({
    queryKey: ["erp-fin", "transactions", ...key],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select(
          "id, type, category, amount, description, date, time, payment_method, pix_amount, cash_amount, credit_card_amount, debit_card_amount, credits_amount, cashback_amount, barber_id, customer_id, appointment_id, created_at, barber:barbers(name), appointment:appointments(status, source, appointment_type, start_time, total_price, original_total, final_amount, discount_amount, products_amount, tip_amount, subscription_covered_amount, services(name), customers(name))",
        )
        .eq("tenant_id", tenantId!);
      if (range.start) q = q.gte("date", isoDate(range.start));
      if (range.end) q = q.lte("date", isoDate(range.end));
      const { data, error } = await q.order("date", { ascending: true }).limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const appointments = useQuery({
    queryKey: ["erp-fin", "appointments", ...key],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select(
          "id, status, source, appointment_type, payment_status, payment_method, start_time, total_price, original_total, final_amount, discount_amount, products_amount, tip_amount, cashback_used, credits_used, subscription_covered_amount, subscription_id, coupon_code, barber_id, customer_id, service_id, services(name), customers(name), barber:barbers!appointments_barber_id_fkey(name)",
        )
        .eq("tenant_id", tenantId!);
      if (range.start) q = q.gte("start_time", iso(range.start));
      if (range.end) q = q.lte("start_time", iso(range.end));
      const { data, error } = await q.order("start_time", { ascending: true }).limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const commissions = useQuery({
    queryKey: ["erp-fin", "commissions", ...key],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      let q = supabase
        .from("barber_commissions")
        .select("id, barber_id, service_name, service_amount, commission_amount, status, paid_at, created_at")
        .eq("tenant_id", tenantId!);
      if (range.start) q = q.gte("created_at", iso(range.start));
      if (range.end) q = q.lte("created_at", iso(range.end));
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const productSales = useQuery({
    queryKey: ["erp-fin", "product-sales", ...key],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      let q = supabase
        .from("product_sales")
        .select("id, total_amount, status, items, created_at, barber_id, customer_id")
        .eq("tenant_id", tenantId!);
      if (range.start) q = q.gte("created_at", iso(range.start));
      if (range.end) q = q.lte("created_at", iso(range.end));
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const cashback = useQuery({
    queryKey: ["erp-fin", "cashback", ...key],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      let q = supabase
        .from("cashback_transactions")
        .select("id, type, amount, base_amount, description, customer_id, created_at")
        .eq("tenant_id", tenantId!);
      if (range.start) q = q.gte("created_at", iso(range.start));
      if (range.end) q = q.lte("created_at", iso(range.end));
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const credits = useQuery({
    queryKey: ["erp-fin", "credits", ...key],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      let q = supabase
        .from("credit_transactions")
        .select("id, type, amount, description, customer_id, created_at")
        .eq("tenant_id", tenantId!);
      if (range.start) q = q.gte("created_at", iso(range.start));
      if (range.end) q = q.lte("created_at", iso(range.end));
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const coupons = useQuery({
    queryKey: ["erp-fin", "coupons", tenantId],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("id, code, type, value, usage_limit, used_count, active, starts_at, expires_at")
        .eq("tenant_id", tenantId!)
        .limit(500);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const subscriptions = useQuery({
    queryKey: ["erp-fin", "subscriptions", tenantId],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_subscriptions")
        .select(
          "id, status, amount, started_at, canceled_at, current_period_end, next_billing_at, renewal_date, plan_id, customer_id",
        )
        .eq("tenant_id", tenantId!)
        .limit(2000);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const plans = useQuery({
    queryKey: ["erp-fin", "plans", tenantId],
    enabled: on,
    ...CACHE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, monthly_price, active")
        .eq("tenant_id", tenantId!)
        .limit(200);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const isLoading =
    transactions.isLoading ||
    appointments.isLoading ||
    commissions.isLoading ||
    productSales.isLoading ||
    cashback.isLoading ||
    credits.isLoading;

  return {
    transactions: transactions.data || [],
    appointments: appointments.data || [],
    commissions: commissions.data || [],
    productSales: productSales.data || [],
    cashback: cashback.data || [],
    credits: credits.data || [],
    coupons: coupons.data || [],
    subscriptions: subscriptions.data || [],
    plans: plans.data || [],
    isLoading,
    refetch: () => {
      transactions.refetch();
      appointments.refetch();
      commissions.refetch();
      productSales.refetch();
      cashback.refetch();
      credits.refetch();
    },
  };
}

export type ErpFinanceData = ReturnType<typeof useErpFinance>;
