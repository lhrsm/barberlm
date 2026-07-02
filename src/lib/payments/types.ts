/**
 * Camada de abstração para gateways de pagamento (assinaturas de clientes finais).
 *
 * IMPORTANTE:
 * - Este módulo é usado APENAS para cobrar assinaturas dos clientes finais da barbearia.
 * - A cobrança das assinaturas do SaaS (barbearias assinam Barbex) continua usando Stripe
 *   diretamente em src/lib/stripe.server.ts e não passa por aqui.
 * - Para adicionar um novo gateway, implemente PaymentProvider em providers/<nome>.server.ts
 *   e registre em providers/index.server.ts. Nenhum outro arquivo precisa mudar.
 */

export type ProviderKey =
  | "mercadopago"
  | "asaas"
  | "stripe"
  | "pagseguro"
  | "pagarme"
  | "paypal"
  | "paggue"
  | "infinitepay"
  | "custom";

export type GatewayEnvironment = "sandbox" | "production";

export interface PaymentGatewayRow {
  id: string;
  tenant_id: string;
  provider: ProviderKey;
  name: string;
  credentials: Record<string, string>;
  environment: GatewayEnvironment;
  webhook_secret?: string | null;
  is_primary: boolean;
  is_active: boolean;
  status: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  accountName?: string;
  scopes?: string[];
  raw?: unknown;
}

export interface CreateSubscriptionInput {
  gateway: PaymentGatewayRow;
  tenantId: string;
  customer: {
    id: string;
    name?: string;
    email?: string;
    document?: string;
    phone?: string;
  };
  plan: {
    id: string;
    name: string;
    amount: number;
    currency?: string;
    intervalMonths?: number;
  };
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionResult {
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  status: "pending" | "active" | "failed";
  raw?: unknown;
}

export interface WebhookEvent {
  provider: ProviderKey;
  eventType: string;
  providerPaymentId?: string;
  providerSubscriptionId?: string;
  status: "paid" | "pending" | "failed" | "refunded" | "canceled" | "unknown";
  amount?: number;
  currency?: string;
  raw: unknown;
}

export interface PaymentProvider {
  key: ProviderKey;
  displayName: string;
  supportsSubscriptions: boolean;

  /** Testa a conexão fazendo uma chamada real ao provider (ex: buscar dados da conta). */
  testConnection(gateway: PaymentGatewayRow): Promise<TestConnectionResult>;

  /** Cria uma assinatura recorrente para um cliente final. */
  createSubscription?(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;

  /** Recebe payload bruto do webhook e devolve evento normalizado. */
  parseWebhook?(payload: unknown, headers: Record<string, string>, gateway: PaymentGatewayRow): Promise<WebhookEvent | null>;
}
