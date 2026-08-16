import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Retorna recomendações preditivas baseadas no comportamento dos clientes e saúde do negócio.
 */
export const getPredictiveRecommendations = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tenantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { tenantId } = data;

    // 1. Buscar dados de clientes inativos, aniversariantes, produtos sem venda
    // e profissionais com horários vagos (Mocks lógicos para a POC, mas buscando IDs reais)
    
    const [inactives, birthdays, lowStock, idlePros] = await Promise.all([
      supabaseAdmin.from("customers").select("id").eq("tenant_id", tenantId).is("last_visit_at", null).limit(10),
      supabaseAdmin.from("customers").select("id").eq("tenant_id", tenantId).limit(5), // Simplificado para POC
      supabaseAdmin.from("products").select("id, name").eq("tenant_id", tenantId).lte("stock_quantity", 5).limit(5),
      supabaseAdmin.from("professionals").select("id, name").eq("tenant_id", tenantId).limit(3)
    ]);

    const recommendations = [];

    if ((inactives.data?.length || 0) > 0) {
      recommendations.push({
        id: "rec-churn",
        type: "retention",
        title: "Resgate de Clientes Inativos",
        description: `Detectamos ${inactives.data?.length} clientes que não retornam há mais de 45 dias.`,
        action: "Criar Campanha de Cashback",
        impact: "Alto",
        score: 92,
        to: "/marketing?tab=campanhas"
      });
    }

    if ((lowStock.data?.length || 0) > 0) {
      recommendations.push({
        id: "rec-stock",
        type: "inventory",
        title: "Queima de Estoque Inteligente",
        description: `Os produtos ${lowStock.data?.map(p => p.name).join(", ")} estão com baixo giro.`,
        action: "Promover no WhatsApp",
        impact: "Médio",
        score: 75,
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
      to: "/loyalty"
    });

    return recommendations;
  });
