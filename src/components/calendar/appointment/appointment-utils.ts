export function resolveImageUrl(entity: any): string | null {
  if (!entity) return null;
  
  // Trata objetos do Supabase com tabelas relacionadas (ex: appointments.customers)
  if (entity.customers && typeof entity.customers === 'object') {
    return (entity.customers as any).avatar_url || null;
  }
  
  if (entity.barbers && typeof entity.barbers === 'object') {
    return (entity.barbers as any).avatar_url || null;
  }

  return (
    entity.avatar_url ||
    entity.photo_url ||
    entity.profile_image_url ||
    entity.image_url ||
    entity.picture_url ||
    null
  );
}

export interface FinancialBreakdown {
  servicePrice: number;
  products: number;
  extras: number;
  discounts: number;
  creditsUsed: number;
  cashbackUsed: number;
  total: number;
}

/** Fonte única e auditável do total do atendimento. */
export function computeAppointmentTotal(input: {
  servicePrice?: number | null;
  products?: number | null;
  extras?: number | null;
  discounts?: number | null;
  creditsUsed?: number | null;
  cashbackUsed?: number | null;
}): FinancialBreakdown {
  const n = (v: any) => {
    const parsed = Number(v ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const servicePrice = n(input.servicePrice);
  const products = n(input.products);
  const extras = n(input.extras);
  const discounts = n(input.discounts);
  const creditsUsed = n(input.creditsUsed);
  const cashbackUsed = n(input.cashbackUsed);
  const total = Math.max(
    0,
    servicePrice + products + extras - discounts - creditsUsed - cashbackUsed,
  );
  return { servicePrice, products, extras, discounts, creditsUsed, cashbackUsed, total };
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function dayKeyFromDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_KEYS[new Date(y, m - 1, d).getDay()];
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type SlotState = "available" | "busy" | "past" | "overflow";

export interface Slot {
  time: string;
  state: SlotState;
  period: "morning" | "afternoon" | "evening";
}

interface BuildSlotsArgs {
  date: string;
  workingHours: any;
  serviceDuration: number;
  bufferMinutes: number;
  busy: Array<{ start: number; end: number }>;
  stepMinutes?: number;
}

/**
 * Gera a grade de horários respeitando expediente, duração do serviço,
 * intervalo entre atendimentos e agendamentos já existentes.
 * Não altera nenhuma regra de disponibilidade do servidor — apenas reflete.
 */
export function buildSlots({
  date,
  workingHours,
  serviceDuration,
  bufferMinutes,
  busy,
  stepMinutes = 30,
}: BuildSlotsArgs): Slot[] {
  if (!workingHours?.enabled || !workingHours?.start || !workingHours?.end) return [];
  const startMin = toMinutes(workingHours.start);
  const endMin = toMinutes(workingHours.end);
  const breakStart = workingHours.break_start ? toMinutes(workingHours.break_start) : null;
  const breakEnd = workingHours.break_end ? toMinutes(workingHours.break_end) : null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: Slot[] = [];
  for (let t = startMin; t < endMin; t += stepMinutes) {
    const finish = t + serviceDuration;
    const period: Slot["period"] = t < 12 * 60 ? "morning" : t < 18 * 60 ? "afternoon" : "evening";
    let state: SlotState = "available";

    if (finish > endMin) state = "overflow";
    else if (date === todayStr && t < nowMinutes) state = "past";
    else if (breakStart !== null && breakEnd !== null && t < breakEnd && finish > breakStart)
      state = "busy";
    else if (busy.some((b) => t < b.end + bufferMinutes && finish + bufferMinutes > b.start))
      state = "busy";

    slots.push({ time: fromMinutes(t), state, period });
  }
  return slots;
}
