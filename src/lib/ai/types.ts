import { z } from "zod";

export const AIContextSchema = z.object({
  tenant_id: z.string().uuid(),
  barbershop_id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'manager', 'finance', 'barber', 'reception', 'super_admin']),
  permissions: z.array(z.string()),
  locale: z.string().default('pt-BR'),
  timezone: z.string().default('America/Sao_Paulo'),
  plan_id: z.string().optional(),
  enabled_modules: z.array(z.string()),
  active_addons: z.array(z.string()),
  active_voucher: z.string().optional(),
  requested_period: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  allowed_data_scopes: z.array(z.string()),
  correlation_id: z.string()
});

export type AIContext = z.infer<typeof AIContextSchema>;

export interface AITool {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  permission_required: string;
  scope: 'global' | 'tenant' | 'user';
  handler: (input: any, context: AIContext) => Promise<any>;
}

export interface AIResponse {
  content: string;
  sources?: string[];
  tools_called?: string[];
  usage?: {
    tokens: number;
    cost_estimate: number;
  };
  error?: string;
}

export interface AIProvider {
  generate: (prompt: string, context: AIContext) => Promise<AIResponse>;
  stream?: (prompt: string, context: AIContext) => AsyncGenerator<string>;
  healthCheck: () => Promise<boolean>;
}

export const NoopAIProvider: AIProvider = {
  generate: async () => ({
    content: "Assistente Barbex em preparação. O provedor de IA ainda não foi configurado.",
    error: "PROVIDER_NOT_CONFIGURED"
  }),
  healthCheck: async () => false
};
