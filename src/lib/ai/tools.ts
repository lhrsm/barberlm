import { z } from "zod";
import type { AITool, AIContext } from "./types";
import { AIInternalServices } from "./services.server";

/**
 * Registry of authorized tools for the AI Assistant.
 * All tools MUST be read-only in this initial architecture.
 */
export const AIToolRegistry: Record<string, AITool> = {
  get_financial_summary: {
    name: "get_financial_summary",
    description: "Retorna o resumo financeiro (faturamento, ticket médio) do período solicitado.",
    permission_required: "view_finances",
    scope: "tenant",
    parameters: z.object({
      start_date: z.string().describe("Data de início (ISO)"),
      end_date: z.string().describe("Data de fim (ISO)"),
      professional_id: z.string().uuid().optional().describe("ID do profissional para filtrar")
    }),
    handler: async (input, context) => {
      return AIInternalServices.getFinancialSummary(input, context);
    }
  },
  get_occupancy_summary: {
    name: "get_occupancy_summary",
    description: "Retorna a taxa de ocupação dos profissionais e horários mais procurados.",
    permission_required: "view_dashboard",
    scope: "tenant",
    parameters: z.object({
      start_date: z.string(),
      end_date: z.string()
    }),
    handler: async (input, context) => {
      return AIInternalServices.getAppointmentSummary(input, context);
    }
  },
  get_customer_insights: {
    name: "get_customer_insights",
    description: "Identifica clientes inativos, VIPs e tendências de retorno.",
    permission_required: "view_customers",
    scope: "tenant",
    parameters: z.object({
      category: z.enum(['inactive', 'vip', 'churn_risk']).optional()
    }),
    handler: async (input, context) => {
      return { status: "ready_for_implementation", params: input };
    }
  }
};

export const getTool = (name: string) => AIToolRegistry[name];
export const listTools = () => Object.values(AIToolRegistry).map(t => ({
  name: t.name,
  description: t.description,
  parameters: t.parameters
}));
