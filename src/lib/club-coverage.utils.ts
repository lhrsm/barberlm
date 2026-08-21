/**
 * Canonical Club Coverage Engine for Barbex
 * Unifies subscription benefit resolution across Public Booking, Command Center,
 * Calendar, Customer Portal, and Checkout flows.
 */

export interface ClubCoverageInput {
  customer?: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  service: {
    id: string;
    name: string;
    price: number;
    category?: string | null;
  };
  subscription?: {
    id?: string;
    status?: string;
    plan_id?: string;
    plan?: {
      id?: string;
      name?: string;
      max_uses_per_month?: number | null;
      usage_type?: string;
    } | null;
  } | null;
  eligibility?: {
    has_active_subscription?: boolean;
    subscription_id?: string;
    plan_id?: string;
    plan_name?: string;
    service_included?: boolean;
    requires_payment?: boolean;
    service_price?: number;
    covered_amount?: number;
    extra_amount_to_pay?: number;
    remaining_uses?: number | null;
    reason?: string;
    next_billing_date?: string | null;
  } | null;
  appointmentDate?: string | Date;
}

export interface ClubCoverageResult {
  isSubscriber: boolean;
  subscriptionStatus: string;
  planId: string | null;
  planName: string | null;
  serviceEligible: boolean;
  monthlyLimit: number | null;
  usedThisCycle: number;
  remainingThisCycle: number | null;
  coveredByPlan: boolean;
  coveredAmount: number;
  extraAmountToPay: number;
  reason: 'FULL_COVERAGE' | 'NOT_INCLUDED' | 'MONTHLY_LIMIT_REACHED' | 'NO_ACTIVE_SUBSCRIPTION' | 'UNKNOWN';
  message: string;
  subtext?: string;
}

/**
 * Resolves whether a service is covered under the customer's active subscription.
 *
 * Rules:
 * 1. An active subscription is required.
 * 2. The service must be explicitly part of the plan (e.g. hair/beard yes, eyebrows no).
 * 3. Monthly franchise must have remaining balance (e.g., used < max_uses_per_month).
 * 4. Credits / Cashback do NOT make an ineligible service covered by the club.
 */
export function resolveClubCoverage(input: ClubCoverageInput): ClubCoverageResult {
  const { service, subscription, eligibility } = input;
  const servicePrice = Number(service?.price) || 0;

  const hasActiveSub = !!(
    eligibility?.has_active_subscription ||
    (subscription && (subscription.status === 'active' || subscription.status === 'trialing'))
  );

  if (!hasActiveSub) {
    return {
      isSubscriber: false,
      subscriptionStatus: subscription?.status || 'inactive',
      planId: null,
      planName: null,
      serviceEligible: false,
      monthlyLimit: null,
      usedThisCycle: 0,
      remainingThisCycle: null,
      coveredByPlan: false,
      coveredAmount: 0,
      extraAmountToPay: servicePrice,
      reason: 'NO_ACTIVE_SUBSCRIPTION',
      message: 'Cliente não possui plano ativo'
    };
  }

  const planId = eligibility?.plan_id || subscription?.plan_id || subscription?.plan?.id || null;
  const planName = eligibility?.plan_name || subscription?.plan?.name || 'Clube Barbex';
  const monthlyLimit = subscription?.plan?.max_uses_per_month ?? 8;

  // Check remaining uses
  const remainingUses = eligibility?.remaining_uses !== undefined && eligibility?.remaining_uses !== null
    ? eligibility.remaining_uses
    : (monthlyLimit ? Math.max(0, monthlyLimit) : null);

  const usedThisCycle = monthlyLimit !== null && remainingUses !== null
    ? Math.max(0, monthlyLimit - remainingUses)
    : 0;

  // Check service inclusion
  const isIncluded = eligibility?.service_included !== undefined
    ? eligibility.service_included
    : true; // Default to true if not explicitly excluded by RPC

  // RULE 1: Service not included in plan (e.g. Sobrancelha)
  if (!isIncluded || eligibility?.reason === 'not_included') {
    return {
      isSubscriber: true,
      subscriptionStatus: 'active',
      planId,
      planName,
      serviceEligible: false,
      monthlyLimit,
      usedThisCycle,
      remainingThisCycle: remainingUses,
      coveredByPlan: false,
      coveredAmount: 0,
      extraAmountToPay: servicePrice,
      reason: 'NOT_INCLUDED',
      message: 'Este serviço não está incluído no seu plano',
      subtext: 'Cobrança avulsa'
    };
  }

  // RULE 2: Monthly allowance exhausted (e.g. 8 of 8 used)
  if ((remainingUses !== null && remainingUses <= 0) || eligibility?.reason === 'no_uses_left') {
    return {
      isSubscriber: true,
      subscriptionStatus: 'active',
      planId,
      planName,
      serviceEligible: true,
      monthlyLimit,
      usedThisCycle: monthlyLimit || 8,
      remainingThisCycle: 0,
      coveredByPlan: false,
      coveredAmount: 0,
      extraAmountToPay: servicePrice,
      reason: 'MONTHLY_LIMIT_REACHED',
      message: `Você já utilizou os ${monthlyLimit || 8} serviços incluídos neste ciclo.`,
      subtext: 'Este atendimento será cobrado como avulso.'
    };
  }

  // RULE 3: Covered by Club Barbex
  return {
    isSubscriber: true,
    subscriptionStatus: 'active',
    planId,
    planName,
    serviceEligible: true,
    monthlyLimit,
    usedThisCycle,
    remainingThisCycle: remainingUses,
    coveredByPlan: true,
    coveredAmount: servicePrice,
    extraAmountToPay: 0,
    reason: 'FULL_COVERAGE',
    message: 'Coberto pelo Clube Barbex',
    subtext: remainingUses !== null
      ? `Este atendimento utilizará 1 dos ${remainingUses} serviços restantes.`
      : 'Atendimento incluído no seu plano ativo.'
  };
}
