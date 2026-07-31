/**
 * Tokens visuais da Agenda Premium.
 * Apenas apresentação — nenhuma regra de negócio aqui.
 */

export type AgendaStatusKey =
  | "completed"
  | "paid"
  | "cancelled"
  | "no_show"
  | "confirmed"
  | "rescheduled"
  | "in_service"
  | "awaiting_payment"
  | "scheduled";

export interface AgendaStatusConfig {
  key: AgendaStatusKey;
  label: string;
  /** chip / badge */
  badge: string;
  /** borda do card */
  ring: string;
  /** barra lateral / ponto */
  accent: string;
  /** cor sólida para timeline */
  bar: string;
  /** fundo sutil do card */
  surface: string;
}

const CONFIGS: Record<AgendaStatusKey, AgendaStatusConfig> = {
  completed: {
    key: "completed",
    label: "Concluído",
    badge: "bg-[#F5C542]/12 text-[#F5C542] border-[#F5C542]/35",
    ring: "border-[#F5C542]/25",
    accent: "bg-[#F5C542]",
    bar: "bg-gradient-to-b from-[#F5C542]/25 to-[#F5C542]/10",
    surface: "bg-[#0B1220]",
  },
  paid: {
    key: "paid",
    label: "Pago",
    badge: "bg-[#F5C542]/12 text-[#F5C542] border-[#F5C542]/35",
    ring: "border-[#F5C542]/25",
    accent: "bg-[#E6B22E]",
    bar: "bg-gradient-to-b from-[#F5C542]/25 to-[#F5C542]/10",
    surface: "bg-[#0B1220]",
  },
  cancelled: {
    key: "cancelled",
    label: "Cancelado",
    badge: "bg-slate-500/12 text-slate-300 border-slate-400/30",
    ring: "border-slate-500/20",
    accent: "bg-slate-500",
    bar: "bg-slate-500/15",
    surface: "bg-[#0B1220]/70",
  },
  no_show: {
    key: "no_show",
    label: "Faltou",
    badge: "bg-slate-600/15 text-slate-400 border-slate-500/30",
    ring: "border-slate-600/20",
    accent: "bg-slate-600",
    bar: "bg-slate-600/15",
    surface: "bg-[#0B1220]/70",
  },
  confirmed: {
    key: "confirmed",
    label: "Confirmado",
    badge: "bg-emerald-500/12 text-emerald-300 border-emerald-500/30",
    ring: "border-emerald-500/25",
    accent: "bg-emerald-500",
    bar: "bg-emerald-500/15",
    surface: "bg-[#0B1220]",
  },
  rescheduled: {
    key: "rescheduled",
    label: "Reagendado",
    badge: "bg-sky-500/12 text-sky-300 border-sky-500/30",
    ring: "border-sky-500/25",
    accent: "bg-sky-500",
    bar: "bg-sky-500/15",
    surface: "bg-[#0B1220]",
  },
  in_service: {
    key: "in_service",
    label: "Em atendimento",
    badge: "bg-amber-500/12 text-amber-300 border-amber-500/30",
    ring: "border-amber-500/30",
    accent: "bg-amber-500",
    bar: "bg-amber-500/15",
    surface: "bg-[#0B1220]",
  },
  awaiting_payment: {
    key: "awaiting_payment",
    label: "Pgto pendente",
    badge: "bg-amber-500/12 text-amber-300 border-amber-500/30",
    ring: "border-amber-500/25",
    accent: "bg-amber-500",
    bar: "bg-amber-500/15",
    surface: "bg-[#0B1220]",
  },
  scheduled: {
    key: "scheduled",
    label: "Agendado",
    badge: "bg-yellow-400/10 text-yellow-200 border-yellow-400/30",
    ring: "border-yellow-400/20",
    accent: "bg-yellow-400",
    bar: "bg-yellow-400/12",
    surface: "bg-[#0B1220]",
  },
};

export function getAgendaStatus(status?: string | null): AgendaStatusConfig {
  const n = String(status || "").toLowerCase();
  if (["completed", "concluido", "concluído", "done"].includes(n)) return CONFIGS.completed;
  if (["paid", "pago"].includes(n)) return CONFIGS.paid;
  if (["cancelled", "canceled", "cancelado"].includes(n)) return CONFIGS.cancelled;
  if (["no_show", "faltou", "missed"].includes(n)) return CONFIGS.no_show;
  if (["confirmed", "confirmado"].includes(n)) return CONFIGS.confirmed;
  if (["rescheduled", "reagendado"].includes(n)) return CONFIGS.rescheduled;
  if (["in_service", "em_atendimento"].includes(n)) return CONFIGS.in_service;
  if (n === "awaiting_payment") return CONFIGS.awaiting_payment;
  return CONFIGS.scheduled;
}

export const AGENDA_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "scheduled", label: "Agendado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "in_service", label: "Em atendimento" },
  { value: "completed", label: "Concluído" },
  { value: "rescheduled", label: "Reagendado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "no_show", label: "Faltou" },
];

export type AgendaOrigin = "walk_in" | "online" | "manual";

export function getAgendaOrigin(app: any): AgendaOrigin {
  const t = String(app?.appointment_type || "").toLowerCase();
  if (t === "walk_in" || t === "walkin") return "walk_in";
  const src = String(app?.source || app?.origin || "").toLowerCase();
  if (src.includes("public") || src.includes("online") || src.includes("portal")) return "online";
  if (t === "online") return "online";
  return "manual";
}

export const ORIGIN_META: Record<AgendaOrigin, { label: string; chip: string }> = {
  walk_in: {
    label: "Presencial",
    chip: "bg-violet-500/12 text-violet-300 border-violet-500/30",
  },
  online: {
    label: "Online",
    chip: "bg-sky-500/12 text-sky-300 border-sky-500/30",
  },
  manual: {
    label: "Manual",
    chip: "bg-white/5 text-slate-300 border-white/10",
  },
};

/** Paleta estável por profissional (cor derivada do id). */
const BARBER_COLORS = [
  "#F5C542",
  "#4ADE80",
  "#60A5FA",
  "#C084FC",
  "#FB923C",
  "#2DD4BF",
  "#F472B6",
  "#A3E635",
];

export function barberColor(barberId?: string | null): string {
  if (!barberId) return "#94A3B8";
  let hash = 0;
  for (let i = 0; i < barberId.length; i++) hash = (hash * 31 + barberId.charCodeAt(i)) >>> 0;
  return BARBER_COLORS[hash % BARBER_COLORS.length];
}

export function paymentLabel(method?: string | null): string {
  const m = String(method || "").toLowerCase();
  const map: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    dinheiro: "Dinheiro",
    credit: "Crédito",
    credit_card: "Crédito",
    debit: "Débito",
    debit_card: "Débito",
    card: "Cartão",
    subscription: "Assinatura",
    plan: "Plano",
    free: "Cortesia",
  };
  return map[m] || (method ? String(method) : "—");
}
