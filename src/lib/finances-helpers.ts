import { formatInTimeZone } from "date-fns-tz";

export const TIMEZONE = "America/Sao_Paulo";

export function formatTransactionTimeForEdit(transaction: any) {
  if (transaction.appointment?.start_time) {
    return formatInTimeZone(new Date(transaction.appointment.start_time), TIMEZONE, "HH:mm");
  }
  if (typeof transaction.time === "string") {
    return transaction.time.substring(0, 5);
  }
  return "12:00";
}

export function formatTransactionDateForEdit(transaction: any) {
  if (transaction.appointment?.start_time) {
    return formatInTimeZone(new Date(transaction.appointment.start_time), TIMEZONE, "yyyy-MM-dd");
  }
  return transaction.date || new Date().toISOString().split("T")[0];
}

export function formatMixedPaymentLabel(t: any) {
  const parts: string[] = [];

  const pix = Number(t.pix_amount || t.appointment?.pix_amount || 0);
  const cash = Number(t.cash_amount || t.appointment?.cash_amount || 0);
  const card = Number(
    t.credit_card_amount ||
      t.debit_card_amount ||
      t.appointment?.credit_card_amount ||
      t.appointment?.debit_card_amount ||
      0,
  );
  const credits = Number(t.credits_amount || t.appointment?.credits_used || t.appointment?.credit_used || 0);
  const cashback = Number(t.cashback_amount || t.appointment?.cashback_used || 0);

  if (pix > 0) parts.push(`PIX R$ ${pix.toFixed(2)}`);
  if (cash > 0) parts.push(`DINHEIRO R$ ${cash.toFixed(2)}`);
  if (card > 0) parts.push(`CARTÃO R$ ${card.toFixed(2)}`);
  if (credits > 0) parts.push(`CRÉDITO R$ ${credits.toFixed(2)}`);
  if (cashback > 0) parts.push(`CASHBACK R$ ${cashback.toFixed(2)}`);

  return parts.length > 0
    ? parts.join(" + ")
    : t.payment_method === "mixed" || t.appointment?.payment_method === "mixed"
      ? "Pagamento Misto"
      : null;
}

export type BarberPeriodPreset = "today" | "yesterday" | "week" | "month" | "prev_month" | "all" | "custom";

export function computeBarberPeriodRange(
  preset: BarberPeriodPreset | string,
  customStart: string,
  customEnd: string,
): { start: string | null; end: string | null } {
  const toISO = (d: Date) => d.toISOString().split("T")[0];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date | null = today;
  let end: Date | null = today;
  if (preset === "today") {
    start = today;
    end = today;
  } else if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    start = y;
    end = y;
  } else if (preset === "week") {
    const s = new Date(today);
    s.setDate(s.getDate() - s.getDay());
    start = s;
    end = today;
  } else if (preset === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = today;
  } else if (preset === "prev_month") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (preset === "all") {
    start = null;
    end = null;
  } else if (preset === "custom") {
    start = customStart ? new Date(customStart + "T00:00:00") : null;
    end = customEnd ? new Date(customEnd + "T00:00:00") : null;
  }
  return { start: start ? toISO(start) : null, end: end ? toISO(end) : null };
}

export function isDateInBarberRange(
  date: string | null | undefined,
  range: { start: string | null; end: string | null },
) {
  if (!date) return false;
  const d = String(date).slice(0, 10);
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}
