import { daysBetween, brl } from "@/components/intelligence/engine";

export type InsightPriority = "critical" | "high" | "medium" | "low" | "info";
export type InsightStatus = "active" | "resolved" | "dismissed" | "snoozed" | "expired";
export type InsightCategory = 
  | "Operation" 
  | "Agenda" 
  | "Customers" 
  | "Finance" 
  | "Barbers" 
  | "Products" 
  | "Inventory" 
  | "Subscriptions" 
  | "Loyalty" 
  | "Marketing" 
  | "Support" 
  | "Integration";

export interface OperationalInsight {
  id: string;
  rule_key: string;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  description: string;
  evidence: string;
  metric_value?: string | number;
  comparison_value?: string | number;
  entity_type?: string;
  entity_id?: string;
  suggested_action: string;
  destination_route: string;
  generated_at: string;
  status: InsightStatus;
  metadata?: any;
}

export interface OperationalIntelligenceData {
  appointments: any[];
  customers: any[];
  transactions: any[];
  products: any[];
  productSales: any[];
  barbers: any[];
  commissions: any[];
  subscriptions: any[];
  reviews: any[];
  interactions: any[]; // Data from operational_insights_interactions
}

export function generateOperationalInsights(data: OperationalIntelligenceData): OperationalInsight[] {
  const insights: OperationalInsight[] = [];
  const now = new Date();
  const todayIso = now.toISOString().split("T")[0];

  const {
    appointments,
    customers,
    transactions,
    products,
    productSales,
    barbers,
    commissions,
    subscriptions,
    reviews,
    interactions
  } = data;

  const isDismissed = (ruleKey: string, entityId?: string) => 
    interactions.some(i => i.rule_key === ruleKey && i.entity_id === (entityId || null) && (i.status === 'dismissed' || i.status === 'resolved'));

  // --- AGENDA RULES ---
  
  // 1. Horários vagos hoje
  const todayAppts = appointments.filter(a => a.start_time?.startsWith(todayIso) && a.status !== 'cancelled' && a.status !== 'no_show');
  const activeBarbers = barbers.filter(b => b.active);
  const potentialSlotsPerBarber = 10; // Simplificação: 10 slots de 1h
  const totalCapacity = activeBarbers.length * potentialSlotsPerBarber;
  const freeSlots = Math.max(0, totalCapacity - todayAppts.length);

  if (freeSlots > 3 && !isDismissed('agenda_free_slots_today')) {
    insights.push({
      id: `agenda-free-${todayIso}`,
      rule_key: 'agenda_free_slots_today',
      category: 'Agenda',
      priority: 'medium',
      title: 'Capacidade ociosa hoje',
      description: `Existem aproximadamente ${freeSlots} horários vagos para hoje.`,
      evidence: `${todayAppts.length} agendamentos para ${activeBarbers.length} profissionais ativos.`,
      metric_value: freeSlots,
      suggested_action: 'Abrir Agenda / Criar Promoção',
      destination_route: '/calendar',
      generated_at: now.toISOString(),
      status: 'active'
    });
  }

  // 2. No-show em alta (últimos 7 dias vs anterior)
  const last7Days = appointments.filter(a => daysBetween(a.start_time) <= 7);
  const prev7Days = appointments.filter(a => daysBetween(a.start_time) > 7 && daysBetween(a.start_time) <= 14);
  const noShowRate = last7Days.length ? (last7Days.filter(a => a.status === 'no_show').length / last7Days.length) * 100 : 0;
  const prevNoShowRate = prev7Days.length ? (prev7Days.filter(a => a.status === 'no_show').length / prev7Days.length) * 100 : 0;

  if (noShowRate > 15 && noShowRate > prevNoShowRate && !isDismissed('agenda_high_noshow')) {
    insights.push({
      id: 'agenda-noshow-alert',
      rule_key: 'agenda_high_noshow',
      category: 'Agenda',
      priority: 'high',
      title: 'Aumento de No-Shows',
      description: 'A taxa de não comparecimento subiu nos últimos 7 dias.',
      evidence: `Taxa atual: ${noShowRate.toFixed(1)}% vs ${prevNoShowRate.toFixed(1)}% no período anterior.`,
      metric_value: `${noShowRate.toFixed(1)}%`,
      suggested_action: 'Revisar Lembretes de WhatsApp',
      destination_route: '/settings',
      generated_at: now.toISOString(),
      status: 'active'
    });
  }

  // --- CUSTOMER RULES ---

  // 3. Clientes VIP sumidos
  const vips = customers.filter(c => Number(c.total_spent || 0) > 500);
  vips.forEach(vip => {
    const daysSince = vip.last_visit ? daysBetween(vip.last_visit) : 999;
    if (daysSince > 45 && !isDismissed('customer_vip_inactive', vip.id)) {
      insights.push({
        id: `vip-inactive-${vip.id}`,
        rule_key: 'customer_vip_inactive',
        category: 'Customers',
        priority: 'high',
        title: 'Cliente VIP Inativo',
        description: `${vip.name} (VIP) não retorna há ${daysSince} dias.`,
        evidence: `Gasto total: ${brl(vip.total_spent)}. Última visita em ${new Date(vip.last_visit).toLocaleDateString()}.`,
        entity_type: 'customer',
        entity_id: vip.id,
        suggested_action: 'Enviar Mensagem Personalizada',
        destination_route: `/customers?id=${vip.id}`,
        generated_at: now.toISOString(),
        status: 'active'
      });
    }
  });

  // --- FINANCE RULES ---

  // 4. Pagamentos Pendentes
  const pendingAppts = appointments.filter(a => a.status === 'completed' && a.payment_status === 'pending');
  if (pendingAppts.length > 0 && !isDismissed('finance_pending_payments')) {
    const totalPending = pendingAppts.reduce((acc, a) => acc + Number(a.final_amount || 0), 0);
    insights.push({
      id: 'finance-pending',
      rule_key: 'finance_pending_payments',
      category: 'Finance',
      priority: 'critical',
      title: 'Pagamentos Pendentes',
      description: `Existem ${pendingAppts.length} atendimentos concluídos sem registro de pagamento.`,
      evidence: `Valor total a receber: ${brl(totalPending)}.`,
      metric_value: brl(totalPending),
      suggested_action: 'Conciliar Financeiro',
      destination_route: '/finances',
      generated_at: now.toISOString(),
      status: 'active'
    });
  }

  // --- INVENTORY RULES ---

  // 5. Estoque Crítico
  products.forEach(p => {
    if (p.active && Number(p.stock_quantity || 0) <= 2 && !isDismissed('inventory_low_stock', p.id)) {
      insights.push({
        id: `stock-low-${p.id}`,
        rule_key: 'inventory_low_stock',
        category: 'Inventory',
        priority: p.stock_quantity === 0 ? 'critical' : 'medium',
        title: p.stock_quantity === 0 ? 'Produto Sem Estoque' : 'Estoque Crítico',
        description: `O produto "${p.name}" está com ${p.stock_quantity} unidades.`,
        evidence: `Giro médio não calculado, mas estoque está abaixo do limite de segurança (2).`,
        entity_type: 'product',
        entity_id: p.id,
        suggested_action: 'Repor Estoque',
        destination_route: '/products',
        generated_at: now.toISOString(),
        status: 'active'
      });
    }
  });

  // --- INTEGRATION RULES ---

  // 6. WhatsApp Desconectado (Simulação baseada em ausência de envios recentes se houver fila)
  // Nota: Idealmente checaríamos o status da Z-API, mas aqui usamos dados indiretos
  // Para este exemplo, vamos focar em dados que temos.

  return insights.sort((a, b) => {
    const priorityMap = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return priorityMap[a.priority] - priorityMap[b.priority];
  });
}
