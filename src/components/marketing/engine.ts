/**
 * Motor da Central de Marketing — 100% cálculo local sobre dados já existentes.
 * Sem escrita, sem novas regras de negócio, sem disparo de automações.
 */
import type { MarketingData } from "./useMarketingData";
import type { Intelligence } from "@/components/intelligence/engine";

const n = (v: any) => Number(v || 0);
const DAY = 86400000;

export type CampaignChannel = "whatsapp" | "portal" | "sistema";

export interface UnifiedCampaign {
  id: string;
  name: string;
  objective: string;
  status: "ativa" | "agendada" | "encerrada" | "rascunho";
  date: string | null;
  customers: number;
  result: string;
  origin: "Campanhas" | "Fidelidade";
  channel: CampaignChannel;
  editTo?: string;
}

export interface AutomationRow {
  id: string;
  label: string;
  group: string;
  active: boolean;
  channel: string;
  lastRun: string | null;
  sent: number;
  failed: number;
  updatedAt: string | null;
}

export interface MarketingSummary {
  activeCampaigns: number;
  endedCampaigns: number;
  impactedCustomers: number;
  messagesSent: number;
  openRate: number;
  responseRate: number;
  loyalCustomers: number;
  revenueGenerated: number;
}

export interface SeasonalSuggestion {
  id: string;
  title: string;
  date: string;
  daysAway: number;
  idea: string;
}

export interface LibraryCampaign {
  id: string;
  title: string;
  description: string;
  objective: string;
  segment: string;
  audience: number;
  message: string;
  to: string;
}

const STATUS_MAP: Record<string, UnifiedCampaign["status"]> = {
  active: "ativa",
  running: "ativa",
  sent: "encerrada",
  completed: "encerrada",
  finished: "encerrada",
  expired: "encerrada",
  paused: "encerrada",
  scheduled: "agendada",
  pending: "agendada",
  draft: "rascunho",
};

const AUTOMATION_LABELS: { match: RegExp; label: string; group: string }[] = [
  { match: /confirm/i, label: "Confirmações", group: "Agenda" },
  { match: /cancel/i, label: "Cancelamentos", group: "Agenda" },
  { match: /reschedul|reagend/i, label: "Reagendamentos", group: "Agenda" },
  { match: /review|avalia/i, label: "Avaliações", group: "Relacionamento" },
  { match: /remind|lembre/i, label: "Lembretes", group: "Agenda" },
  { match: /birthday|anivers/i, label: "Aniversário", group: "Relacionamento" },
  { match: /inactive|inativ|winback/i, label: "Clientes inativos", group: "Retenção" },
  { match: /product|produto/i, label: "Produtos", group: "Vendas" },
  { match: /subscription|assinatura/i, label: "Assinaturas", group: "Recorrência" },
  { match: /payment|pagamento|cobran/i, label: "Cobranças", group: "Financeiro" },
];

const labelFor = (key: string) => AUTOMATION_LABELS.find((a) => a.match.test(key));

const SEASONAL: { id: string; title: string; month: number; day: number; idea: string }[] = [
  { id: "carnaval", title: "Carnaval", month: 2, day: 14, idea: "Combo corte + barba para o bloco." },
  { id: "volta-aulas", title: "Volta às aulas", month: 2, day: 1, idea: "Desconto infantil e pacote família." },
  { id: "dia-maes", title: "Dia das Mães", month: 5, day: 11, idea: "Vale-presente para o filho levar a mãe." },
  { id: "dia-namorados", title: "Dia dos Namorados", month: 6, day: 12, idea: "Cupom casal e kit de barba." },
  { id: "dia-pais", title: "Dia dos Pais", month: 8, day: 10, idea: "Pai e filho pagam 1,5 no corte." },
  { id: "dia-criancas", title: "Dia das Crianças", month: 10, day: 12, idea: "Corte kids com brinde." },
  { id: "black-friday", title: "Black Friday", month: 11, day: 28, idea: "Pacote de 4 cortes com cashback dobrado." },
  { id: "natal", title: "Natal", month: 12, day: 25, idea: "Vale-presente e combo de produtos." },
  { id: "ano-novo", title: "Ano Novo", month: 12, day: 31, idea: "Agenda de virada com horário estendido." },
];

export function buildSeasonal(now = new Date()): SeasonalSuggestion[] {
  return SEASONAL.map((s) => {
    let d = new Date(now.getFullYear(), s.month - 1, s.day);
    if (+d < +now - 3 * DAY) d = new Date(now.getFullYear() + 1, s.month - 1, s.day);
    return {
      id: s.id,
      title: s.title,
      date: d.toISOString(),
      daysAway: Math.round((+d - +now) / DAY),
      idea: s.idea,
    };
  }).sort((a, b) => a.daysAway - b.daysAway);
}

export interface MarketingModel {
  summary: MarketingSummary;
  campaigns: UnifiedCampaign[];
  automations: AutomationRow[];
  results: { month: string; campaigns: number; messages: number; impacted: number }[];
  seasonal: SeasonalSuggestion[];
  library: LibraryCampaign[];
  opportunities: { id: string; text: string; to: string; label: string }[];
  cashback: {
    totalBalance: number;
    withBalance: number;
    used: number;
    expiring: number;
  };
}

export function buildMarketing(data: MarketingData, iq: Intelligence, now = new Date()): MarketingModel {
  const { campaigns, campaignLogs, automations, automationTemplates, automationLogs, cashbackTx, loyaltyCampaigns } =
    data;

  // ——— Campanhas unificadas ———
  const logsByCampaign: Record<string, any[]> = {};
  campaignLogs.forEach((l) => {
    if (l.campaign_id) (logsByCampaign[l.campaign_id] ||= []).push(l);
  });

  const unified: UnifiedCampaign[] = [
    ...campaigns.map((c) => {
      const logs = logsByCampaign[c.id] || [];
      const delivered = logs.filter((l) => ["sent", "delivered", "read"].includes(String(l.status))).length;
      return {
        id: c.id,
        name: c.title || "Campanha",
        objective: String(c.content || "").slice(0, 90) || "Comunicação com clientes",
        status: STATUS_MAP[String(c.status)] || "rascunho",
        date: c.scheduled_at || c.created_at || null,
        customers: n(c.total_recipients) || logs.length,
        result: logs.length ? `${delivered}/${logs.length} entregues` : "Sem envios",
        origin: "Campanhas" as const,
        channel: "whatsapp" as CampaignChannel,
        editTo: "/campaigns",
      };
    }),
    ...loyaltyCampaigns.map((c) => ({
      id: c.id,
      name: c.name || "Campanha de fidelidade",
      objective: c.description || c.rule_type || "Fidelização",
      status: STATUS_MAP[String(c.status)] || "rascunho",
      date: c.starts_at || c.created_at || null,
      customers: 0,
      result: c.category ? `Categoria: ${c.category}` : "—",
      origin: "Fidelidade" as const,
      channel: "portal" as CampaignChannel,
      editTo: "/loyalty/campaigns",
    })),
  ].sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0));

  // ——— Resumo executivo ———
  const sentLogs = campaignLogs.filter((l) => l.sent_at);
  const opened = campaignLogs.filter((l) => ["read", "delivered"].includes(String(l.status))).length;
  const responded = campaignLogs.filter((l) => !!l.response).length;
  const impacted = new Set(campaignLogs.map((l) => l.customer_id).filter(Boolean)).size;
  const loyal = Object.values(iq.customersById).filter((c) => c.visits >= 3).length;

  const summary: MarketingSummary = {
    activeCampaigns: unified.filter((c) => c.status === "ativa" || c.status === "agendada").length,
    endedCampaigns: unified.filter((c) => c.status === "encerrada").length,
    impactedCustomers: impacted,
    messagesSent: sentLogs.length,
    openRate: campaignLogs.length ? (opened / campaignLogs.length) * 100 : 0,
    responseRate: campaignLogs.length ? (responded / campaignLogs.length) * 100 : 0,
    loyalCustomers: loyal,
    revenueGenerated: iq.finance.revenueThisMonth,
  };

  // ——— Automações (painel de leitura) ———
  const logStats: Record<string, { sent: number; failed: number; last: string | null }> = {};
  automationLogs.forEach((l) => {
    const key = String(l.automation_id || l.message_type || "geral");
    const s = (logStats[key] ||= { sent: 0, failed: 0, last: null });
    const st = String(l.final_status || l.status || "");
    if (/fail|error|erro/i.test(st)) s.failed += 1;
    else s.sent += 1;
    const ts = l.sent_at || l.created_at;
    if (ts && (!s.last || +new Date(ts) > +new Date(s.last))) s.last = ts;
  });

  const automationRows: AutomationRow[] = [
    ...automations.map((a) => {
      const meta = labelFor(String(a.type || ""));
      const st = logStats[a.id] || { sent: 0, failed: 0, last: null };
      return {
        id: a.id,
        label: meta?.label || String(a.type || "Automação").replace(/_/g, " "),
        group: meta?.group || "Outros",
        active: !!a.enabled,
        channel: a.channel || "whatsapp",
        lastRun: st.last,
        sent: st.sent,
        failed: st.failed,
        updatedAt: a.updated_at || a.created_at || null,
      };
    }),
    ...automationTemplates.map((t) => {
      const meta = labelFor(String(t.key || t.trigger_event || ""));
      const st = logStats[t.id] || { sent: 0, failed: 0, last: null };
      return {
        id: t.id,
        label: t.name || meta?.label || String(t.key || "Template"),
        group: t.category || meta?.group || "Templates",
        active: !!t.active,
        channel: t.channel || "whatsapp",
        lastRun: st.last || t.last_notified_at || null,
        sent: st.sent,
        failed: st.failed,
        updatedAt: t.updated_at || null,
      };
    }),
  ];

  // ——— Resultados (últimos 6 meses) ———
  const results: MarketingModel["results"] = [];
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inRange = (d: any) => d && +new Date(d) >= +ref && +new Date(d) < +next;
    results.push({
      month: ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      campaigns: unified.filter((c) => inRange(c.date)).length,
      messages: campaignLogs.filter((l) => inRange(l.sent_at)).length,
      impacted: new Set(campaignLogs.filter((l) => inRange(l.sent_at)).map((l) => l.customer_id)).size,
    });
  }

  // ——— Cashback ———
  const withBalanceRows = iq.cashback.withBalance;
  const used = cashbackTx
    .filter((t) => /use|resgat|redeem|debit/i.test(String(t.type)))
    .reduce((s, t) => s + Math.abs(n(t.amount)), 0);
  const cashback = {
    totalBalance: withBalanceRows.reduce((s, c) => s + c.cashback, 0),
    withBalance: withBalanceRows.length,
    used,
    expiring: iq.credits.expiringSoon.length,
  };

  // ——— Biblioteca de campanhas prontas ———
  const inactive30 = iq.inactiveBuckets
    .filter((b) => b.min >= 30)
    .reduce((s, b) => s + b.rows.length, 0);
  const library: LibraryCampaign[] = [
    {
      id: "inativos-30",
      title: "Cliente sem retornar há 30 dias",
      description: "Reative quem não aparece há mais de um mês.",
      objective: "Reativação",
      segment: "Inativos 30+",
      audience: inactive30,
      message: "Olá {nome}! Faz um tempo que você não passa aqui. Que tal agendar seu corte essa semana?",
      to: "/campaigns",
    },
    {
      id: "aniversariantes",
      title: "Cliente aniversariante",
      description: "Parabenize e ofereça um mimo no mês do aniversário.",
      objective: "Relacionamento",
      segment: "Aniversariantes do mês",
      audience: iq.birthdays.month.length,
      message: "Feliz aniversário, {nome}! 🎉 Preparamos um presente especial para você comemorar com estilo.",
      to: "/campaigns",
    },
    {
      id: "cashback",
      title: "Cliente com cashback disponível",
      description: "Lembre quem tem saldo parado para voltar.",
      objective: "Conversão",
      segment: "Com saldo de cashback",
      audience: iq.cashback.withBalance.length,
      message: "{nome}, você tem cashback disponível na sua conta. Use no seu próximo atendimento!",
      to: "/campaigns",
    },
    {
      id: "creditos",
      title: "Cliente com crédito",
      description: "Créditos não utilizados viram agendamento.",
      objective: "Conversão",
      segment: "Com créditos",
      audience: iq.credits.withBalance.length,
      message: "{nome}, você ainda tem crédito conosco. Vamos marcar seu horário?",
      to: "/campaigns",
    },
    {
      id: "agenda-ociosa",
      title: "Agenda ociosa",
      description: "Preencha horários vagos dos próximos dias.",
      objective: "Ocupação",
      segment: "Clientes recorrentes",
      audience: iq.idle.week.reduce((s, i) => s + i.freeSlots, 0),
      message: "Temos horários livres essa semana, {nome}. Quer garantir o seu?",
      to: "/calendar",
    },
    {
      id: "produto-parado",
      title: "Produto parado",
      description: "Gire o estoque de produtos sem venda.",
      objective: "Vendas",
      segment: "Clientes que compram produtos",
      audience: iq.products.noSales.length,
      message: "{nome}, separamos uma condição especial nos produtos da loja. Dá uma olhada!",
      to: "/products",
    },
    {
      id: "assinatura-renovacao",
      title: "Assinatura próxima da renovação",
      description: "Antecipe a conversa antes da cobrança.",
      objective: "Recorrência",
      segment: "Assinantes renovando",
      audience: iq.subscriptions.renewing.length,
      message: "{nome}, sua assinatura renova em breve. Aproveite todos os benefícios do plano!",
      to: "/subscriptions",
    },
    {
      id: "avaliacao-pendente",
      title: "Avaliação pendente",
      description: "Peça a opinião de quem ainda não avaliou.",
      objective: "Reputação",
      segment: "Atendidos sem avaliação",
      audience: iq.reviews.notReviewed,
      message: "{nome}, como foi seu último atendimento? Sua avaliação ajuda muito a equipe!",
      to: "/reviews",
    },
  ];

  // ——— Centro de oportunidades ———
  const opportunities = [
    inactive30 > 0 && {
      id: "op-inativos",
      text: `Hoje existem ${inactive30} clientes inativos há mais de 30 dias.`,
      to: "/campaigns",
      label: "Criar campanha",
    },
    iq.cashback.withBalance.length > 0 && {
      id: "op-cashback",
      text: `${iq.cashback.withBalance.length} clientes possuem cashback disponível.`,
      to: "/customers",
      label: "Ver clientes",
    },
    iq.idle.tomorrow.length > 0 && {
      id: "op-agenda",
      text: `${iq.idle.tomorrow.reduce((s, i) => s + i.freeSlots, 0)} horários vagos amanhã.`,
      to: "/calendar",
      label: "Abrir agenda",
    },
    iq.birthdays.today.length > 0 && {
      id: "op-niver",
      text: `${iq.birthdays.today.length} clientes aniversariam hoje.`,
      to: "/customers",
      label: "Parabenizar",
    },
    iq.products.noSales.length > 0 && {
      id: "op-produto",
      text: `${iq.products.noSales.length} produtos estão sem venda no período.`,
      to: "/products",
      label: "Ver produtos",
    },
    iq.reviews.negative.length > 0 && {
      id: "op-review",
      text: `${iq.reviews.negative.length} avaliações negativas aguardando resposta.`,
      to: "/reviews",
      label: "Responder",
    },
  ].filter(Boolean) as MarketingModel["opportunities"];

  return {
    summary,
    campaigns: unified,
    automations: automationRows,
    results,
    seasonal: buildSeasonal(now),
    library,
    opportunities,
    cashback,
  };
}
