// Recommendation engine — rules-based today, AI-ready tomorrow.
// Swap `generateRecommendations` for an AI-backed generator without touching the UI.

import { differenceInDays } from "date-fns";

export type RecommendationTone = "gold" | "emerald" | "info" | "warn" | "violet";

export type Recommendation = {
  id: string;
  icon: string; // lucide icon name
  title: string;
  description: string;
  badge?: string;
  tone: RecommendationTone;
  actionLabel: string;
  actionEvent: string; // window CustomEvent name
  priority: number; // higher = shown first
};

export type EngineInput = {
  appointments: any[];
  customerData: any;
  mySubscription: any;
  loyaltyRewards: any[];
  sales: any[];
  coupons?: any[];
  favoriteBarber?: { id: string; name: string } | null;
};

// Category detection heuristics based on service name.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  corte: ["corte"],
  barba: ["barba"],
  combo: ["combo", "cabelo + barba", "cabelo e barba"],
  maquina: ["máquina", "maquina"],
  tesoura: ["tesoura"],
};

const CATEGORY_THRESHOLDS: Record<string, number> = {
  corte: 20,
  barba: 10,
  combo: 20,
  maquina: 20,
  tesoura: 25,
};

function matchCategory(name: string, cat: string) {
  const n = (name || "").toLowerCase();
  return CATEGORY_KEYWORDS[cat].some((k) => n.includes(k));
}

function lastCompletedByCategory(appointments: any[], cat: string) {
  return appointments
    .filter(
      (a) => a.status === "completed" && matchCategory(a.services?.name || a.service_name || "", cat),
    )
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time))[0];
}

export function generateRecommendations(input: EngineInput): Recommendation[] {
  const { appointments, customerData, mySubscription, loyaltyRewards, sales, coupons } = input;
  const out: Recommendation[] = [];

  // Category-based recommendations
  Object.keys(CATEGORY_THRESHOLDS).forEach((cat) => {
    const last = lastCompletedByCategory(appointments, cat);
    if (!last) return;
    const days = differenceInDays(new Date(), new Date(last.start_time));
    if (days >= CATEGORY_THRESHOLDS[cat]) {
      const labels: Record<string, string> = {
        corte: "Está na hora do próximo corte",
        barba: "Sua barba já merece manutenção",
        combo: "Que tal um combo cabelo + barba?",
        maquina: "Hora do corte máquina",
        tesoura: "Hora do corte tesoura",
      };
      out.push({
        id: `cat-${cat}`,
        icon: "Scissors",
        title: labels[cat],
        description: `Último atendimento há ${days} dias. Que tal renovar o visual?`,
        badge: `${days} dias`,
        tone: "gold",
        actionLabel: "Agendar",
        actionEvent: "OPEN_BOOKING_MODAL",
        priority: 90 - Math.max(0, 30 - days),
      });
    }
  });

  // Cashback
  const cashback = Number(customerData?.cashback_balance || 0);
  if (cashback > 0) {
    out.push({
      id: "cashback",
      icon: "Wallet",
      title: "Você tem cashback disponível",
      description: `R$ ${cashback.toFixed(2)} para usar no próximo atendimento.`,
      badge: `R$ ${cashback.toFixed(2)}`,
      tone: "emerald",
      actionLabel: "Utilizar Cashback",
      actionEvent: "OPEN_BOOKING_MODAL",
      priority: 85,
    });
  }

  // Credits
  const credits = Number(customerData?.credits || 0);
  if (credits > 0) {
    out.push({
      id: "credits",
      icon: "Coins",
      title: "Créditos disponíveis",
      description: `Você tem R$ ${credits.toFixed(2)} em créditos ativos.`,
      badge: `R$ ${credits.toFixed(2)}`,
      tone: "emerald",
      actionLabel: "Agendar com créditos",
      actionEvent: "OPEN_BOOKING_MODAL",
      priority: 82,
    });
  }

  // Loyalty rewards — unclaimed
  const unclaimed = (loyaltyRewards || []).filter((r: any) => !r.redeemed_at).length;
  if (unclaimed > 0) {
    out.push({
      id: "loyalty-unclaimed",
      icon: "Gift",
      title: "Você tem recompensas para resgatar",
      description: `${unclaimed} ${unclaimed === 1 ? "recompensa disponível" : "recompensas disponíveis"}.`,
      badge: `${unclaimed}`,
      tone: "gold",
      actionLabel: "Resgatar",
      actionEvent: "OPEN_LOYALTY_MODAL",
      priority: 88,
    });
  }

  // Loyalty progress — near reward
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const step = 10;
  const nextMilestone = Math.ceil((completedCount + 1) / step) * step;
  const missing = nextMilestone - completedCount;
  if (completedCount > 0 && missing > 0 && missing <= 3) {
    out.push({
      id: "loyalty-close",
      icon: "Trophy",
      title: `Faltam ${missing} ${missing === 1 ? "atendimento" : "atendimentos"} para sua próxima recompensa`,
      description: "Você está muito perto de desbloquear um novo benefício.",
      badge: `${completedCount}/${nextMilestone}`,
      tone: "gold",
      actionLabel: "Ver Fidelidade",
      actionEvent: "OPEN_LOYALTY_MODAL",
      priority: 75,
    });
  }

  // Coupons
  if (coupons && coupons.length > 0) {
    out.push({
      id: "coupon",
      icon: "Ticket",
      title: "Você possui cupom disponível",
      description: `${coupons.length} ${coupons.length === 1 ? "cupom" : "cupons"} prontos para uso.`,
      badge: "Novo",
      tone: "violet",
      actionLabel: "Utilizar Cupom",
      actionEvent: "OPEN_BOOKING_MODAL",
      priority: 70,
    });
  }

  // Unreviewed last appointment
  const lastCompleted = appointments
    .filter((a) => a.status === "completed")
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time))[0];
  if (
    lastCompleted &&
    !lastCompleted.appointment_reviews &&
    lastCompleted.review_decision !== "skipped" &&
    lastCompleted.review_decision !== "submitted" &&
    !lastCompleted._review_id
  ) {
    out.push({
      id: "review",
      icon: "Star",
      title: "Avalie seu último atendimento",
      description: `Compartilhe como foi seu ${lastCompleted.services?.name || "atendimento"}.`,
      tone: "info",
      actionLabel: "Avaliar agora",
      actionEvent: "OPEN_REVIEW_MODAL",
      priority: 68,
    });
  }

  // Subscription renewal (for subscribers)
  if (mySubscription?.next_billing_date) {
    const days = differenceInDays(new Date(mySubscription.next_billing_date), new Date());
    if (days >= 0 && days <= 15) {
      out.push({
        id: "renewal",
        icon: "CalendarClock",
        title: `Seu plano renova em ${days} ${days === 1 ? "dia" : "dias"}`,
        description: "A renovação é automática. Confira detalhes do seu plano.",
        badge: `${days}d`,
        tone: "info",
        actionLabel: "Ver Assinatura",
        actionEvent: "OPEN_PLAN_DETAILS_MODAL",
        priority: 60,
      });
    }
  }

  // Non-subscriber upsell
  if (!mySubscription) {
    out.push({
      id: "subscribe",
      icon: "Crown",
      title: "Você pode economizar assinando um plano",
      description: "Conheça o Clube Barbex e desbloqueie benefícios exclusivos.",
      badge: "Premium",
      tone: "gold",
      actionLabel: "Conhecer Planos",
      actionEvent: "OPEN_SUBSCRIBE_MODAL",
      priority: 55,
    });
  }

  // Product replenishment
  const lastSale = sales?.[0];
  if (lastSale) {
    const days = differenceInDays(new Date(), new Date(lastSale.created_at));
    if (days > 60) {
      out.push({
        id: "product-replenish",
        icon: "Package",
        title: "Hora de repor seus produtos",
        description: `Sua última compra foi há ${days} dias.`,
        tone: "info",
        actionLabel: "Ver Produtos",
        actionEvent: "OPEN_PRODUCTS_TAB",
        priority: 50,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}
