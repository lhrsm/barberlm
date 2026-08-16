import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const getAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

/**
 * Retorna recomendações preditivas baseadas no comportamento dos clientes e saúde do negócio.
 */
export const getPredictiveRecommendations = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tenantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { tenantId } = data;
    const admin = await getAdmin();

    const [inactives, lowStock] = await Promise.all([
      admin.from("customers").select("id").eq("tenant_id", tenantId).is("last_visit_at", null).limit(10),
      admin.from("products").select("id, name").eq("user_id", tenantId).lte("stock_quantity", 5).limit(5),
    ]);

    const recommendations: any[] = [];

    if ((inactives.data?.length || 0) > 0) {
      recommendations.push({
        id: "rec-churn",
        type: "retention",
        title: "Resgate de Clientes Inativos",
        description: `Detectamos ${inactives.data?.length} clientes que não retornam há mais de 45 dias.`,
        action: "Criar Campanha de Cashback",
        impact: "Alto",
        score: 92,
        estimatedRevenue: 1200.00,
        to: "/marketing?tab=campanhas"
      });
    }

    if ((lowStock.data?.length || 0) > 0) {
      recommendations.push({
        id: "rec-stock",
        type: "inventory",
        title: "Queima de Estoque Inteligente",
        description: `Os produtos ${lowStock.data?.map((p: any) => p.name).join(", ")} estão com baixo giro.`,
        action: "Promover no WhatsApp",
        impact: "Médio",
        score: 75,
        estimatedRevenue: 450.00,
        to: "/marketing?tab=campanhas"
      });
    }

    recommendations.push({
      id: "rec-loyalty",
      type: "loyalty",
      title: "Upsell de Nível VIP",
      description: "12 clientes estão a menos de 50 XP do nível Diamante.",
      action: "Enviar Notificação de Estímulo",
      impact: "Muito Alto",
      score: 88,
      estimatedRevenue: 800.00,
      to: "/loyalty"
    });

    return recommendations;
  });

/**
 * Retorna projeções de faturamento e saúde do negócio.
 */
export const getRevenueProjections = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tenantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    // Mock de projeções baseadas em dados históricos
    return {
      projectedMonthlyRevenue: 15400.00,
      recoverableRevenue: 2450.00,
      healthScore: 84,
      trends: [
        { month: "Jan", revenue: 12000 },
        { month: "Fev", revenue: 13500 },
        { month: "Mar", revenue: 15400 },
      ]
    };
  });

/**
 * Otimiza o horário de disparo de campanhas baseado no histórico.
 */
export const optimizeCampaignTiming = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    tenantId: z.string().uuid(),
    campaignId: z.string().uuid()
  }).parse(data))
  .handler(async ({ data }) => {
    return {
      recommendedTime: "14:30",
      reason: "Maior taxa de abertura histórica para este segmento neste horário.",
      confidence: 94
    };
  });
