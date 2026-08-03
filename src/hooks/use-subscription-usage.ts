// Single source of truth for subscription usage calculation.
// Used by SubscriberPanel and Benefits tab.

export type ServiceCategory = "haircut" | "beard" | "both" | "other";

export type UsageEntry = {
  id: string;
  used_at: string | null;
  service_name: string;
  category: ServiceCategory;
  haircut_consumed: number;
  beard_consumed: number;
  total_consumed: number;
  covered_amount: number;
  extra_amount: number;
  status: string;
};

export type SubscriptionUsage = {
  plan_name: string;
  cycle_start: Date | null;
  cycle_end: Date | null;
  renewal_date: Date | null;
  total_uses_allowed: number;
  total_uses_consumed: number;
  total_uses_remaining: number;
  total_uses_reserved: number;
  total_uses_available: number;
  haircut_allowed: number;
  haircut_used: number;
  haircut_remaining: number;
  haircut_reserved: number;
  haircut_available: number;
  beard_allowed: number;
  beard_used: number;
  beard_remaining: number;
  beard_reserved: number;
  beard_available: number;
  has_limits: boolean;
  usage_history: UsageEntry[];
};

const COMPLETED_STATUSES = new Set([
  "consumed",
  "completed",
  "concluded",
  "concluído",
  "concluido",
]);

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function categorizeService(name: string | null | undefined): ServiceCategory {
  const n = normalize(name);
  if (!n) return "other";
  const hasBarba = n.includes("barba");
  const hasCorte = n.includes("corte") || n.includes("cabelo") || n.includes("maquina") || n.includes("tesoura");
  const isCombo = n.includes("combo") || (hasBarba && hasCorte);
  if (isCombo) return "both";
  if (hasBarba) return "beard";
  if (hasCorte) return "haircut";
  return "other";
}

export function getSubscriptionUsage(
  subscription: any | null,
  planServices: any[] = [],
  usageLogs: any[] = [],
): SubscriptionUsage {
  const plan = subscription?.plan || {};
  const planName: string = plan?.name || "Assinatura Premium";
  const cycle_start = subscription?.current_period_start
    ? new Date(subscription.current_period_start)
    : subscription?.started_at
    ? new Date(subscription.started_at)
    : null;
  const cycle_end = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : subscription?.next_billing_at
    ? new Date(subscription.next_billing_at)
    : null;
  const renewal_date = cycle_end;

  const total_uses_allowed = Number(plan?.max_uses_per_month ?? 0);

  // Per-category allowance: priorities are subscription_plan_benefits (2.0) then legacy fallback
  let haircut_allowed = 0;
  let beard_allowed = 0;
  
  // Try to find benefits mapping in the new structure if available in the subscription object
  const benefits = subscription?.benefits || plan?.benefits_list || [];
  if (Array.isArray(benefits) && benefits.length > 0) {
    for (const b of benefits) {
      if (b.benefit_key === 'haircut') haircut_allowed = Number(b.monthly_limit);
      if (b.benefit_key === 'beard') beard_allowed = Number(b.monthly_limit);
      if (b.benefit_key === 'combo') {
        haircut_allowed = Math.max(haircut_allowed, Number(b.monthly_limit));
        beard_allowed = Math.max(beard_allowed, Number(b.monthly_limit));
      }
    }
  }

  // Legacy fallback if no 2.0 benefits found
  if (haircut_allowed === 0 && beard_allowed === 0) {
    for (const ps of planServices) {
      const cat = categorizeService(ps?.services?.name);
      const lim = Number(ps?.max_uses_per_period ?? 0);
      if (cat === "haircut") haircut_allowed = Math.max(haircut_allowed, lim);
      else if (cat === "beard") beard_allowed = Math.max(beard_allowed, lim);
      else if (cat === "both") {
        haircut_allowed = Math.max(haircut_allowed, lim);
        beard_allowed = Math.max(beard_allowed, lim);
      }
    }
    
    if (total_uses_allowed > 0 && haircut_allowed === 0 && beard_allowed === 0) {
      // Even split fallback
      haircut_allowed = Math.ceil(total_uses_allowed / 2);
      beard_allowed = Math.floor(total_uses_allowed / 2);
    }
  }

  // Filter logs to current cycle and completed status
  const inCycle = (log: any): boolean => {
    if (!log.used_at) return false;
    const d = new Date(log.used_at);
    if (cycle_start && d < cycle_start) return false;
    if (cycle_end && d > cycle_end) return false;
    return true;
  };
  const isCompleted = (log: any): boolean => {
    const s = normalize(log.status);
    return !s || COMPLETED_STATUSES.has(s);
  };
  const RESERVED_STATUSES = new Set(["scheduled", "confirmed", "agendado", "confirmado", "reserved", "reservado", "pending"]);
  const isReserved = (log: any): boolean => {
    const s = normalize(log.status);
    return RESERVED_STATUSES.has(s);
  };

  const buildEntry = (l: any): UsageEntry => {
    const name = l.services?.name || l.service_name || "Serviço";
    const category = categorizeService(name);
    const isCombo = category === "both";
    const haircut_consumed = category === "haircut" || isCombo ? 1 : 0;
    const beard_consumed = category === "beard" || isCombo ? 1 : 0;
    const total_consumed = haircut_consumed + beard_consumed || Number(l.consume_quantity || 1);
    return {
      id: l.id,
      used_at: l.used_at,
      service_name: name,
      category,
      haircut_consumed,
      beard_consumed,
      total_consumed,
      covered_amount: Number(l.covered_amount || 0),
      extra_amount: Number(l.extra_amount || 0),
      status: l.status || "consumed",
    };
  };

  const usage_history: UsageEntry[] = (usageLogs || [])
    .filter((l) => isCompleted(l) && inCycle(l))
    .map(buildEntry);

  const reservedEntries: UsageEntry[] = (usageLogs || [])
    .filter((l) => isReserved(l) && inCycle(l))
    .map(buildEntry);

  const haircut_used = usage_history.reduce((s, e) => s + e.haircut_consumed, 0);
  const beard_used = usage_history.reduce((s, e) => s + e.beard_consumed, 0);
  const total_uses_consumed = usage_history.reduce((s, e) => s + e.total_consumed, 0);

  const haircut_reserved = reservedEntries.reduce((s, e) => s + e.haircut_consumed, 0);
  const beard_reserved = reservedEntries.reduce((s, e) => s + e.beard_consumed, 0);
  const total_uses_reserved = reservedEntries.reduce((s, e) => s + e.total_consumed, 0);

  const haircut_remaining = Math.max(0, haircut_allowed - haircut_used);
  const beard_remaining = Math.max(0, beard_allowed - beard_used);
  const total_uses_remaining = Math.max(0, total_uses_allowed - total_uses_consumed);

  const haircut_available = Math.max(0, haircut_allowed - haircut_used - haircut_reserved);
  const beard_available = Math.max(0, beard_allowed - beard_used - beard_reserved);
  const total_uses_available = Math.max(0, total_uses_allowed - total_uses_consumed - total_uses_reserved);

  return {
    plan_name: planName,
    cycle_start,
    cycle_end,
    renewal_date,
    total_uses_allowed,
    total_uses_consumed,
    total_uses_remaining,
    total_uses_reserved,
    total_uses_available,
    haircut_allowed,
    haircut_used,
    haircut_remaining,
    haircut_reserved,
    haircut_available,
    beard_allowed,
    beard_used,
    beard_remaining,
    beard_reserved,
    beard_available,
    has_limits: total_uses_allowed > 0,
    usage_history,
  };
}
