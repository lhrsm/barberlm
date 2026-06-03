import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./use-tenant";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";

export type PlanType = "starter" | "pro" | "elite" | "free";

export const PLAN_LIMITS = {
  free: {
    barbers: 1,
    services: 5,
    products: 5,
    monthlyAppointments: 30,
    whatsappConnections: 0,
    hasTrial: true,
    trialDays: 15,
  },
  starter: {
    barbers: 1,
    services: Infinity,
    products: Infinity,
    monthlyAppointments: Infinity,
    whatsappConnections: 1,
    price: 19.90,
  },
  pro: {
    barbers: 5,
    services: Infinity,
    products: Infinity,
    monthlyAppointments: Infinity,
    whatsappConnections: 2,
    price: 39.90,
  },
  elite: {
    barbers: Infinity,
    services: Infinity,
    products: Infinity,
    monthlyAppointments: Infinity,
    whatsappConnections: 5,
    price: 59.90,
  },
};

export function usePlanLimits() {
  const { tenantId } = useTenant();
  const [plan, setPlan] = useState<PlanType>("free");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    status: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
    priceId: string | null;
  } | null>(null);
  const [usage, setUsage] = useState({
    barbers: 0,
    services: 0,
    products: 0,
    monthlyAppointments: 0,
    whatsappConnections: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchPlanAndUsage();
    } else {
      setLoading(false);
    }
  }, [tenantId]);

  async function fetchPlanAndUsage() {
    if (!tenantId) return;
    setLoading(true);

    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    try {
      const [profileRes, subRes, barbRes, servRes, prodRes, appRes, whatsappRes] = await Promise.all([
        supabase.from("profiles").select("plan, effective_plan, selected_plan, created_at, trial_end, status").eq("id", tenantId).maybeSingle(),
        supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end, stripe_customer_id, price_id").eq("user_id", tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from("barbers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("active", true),
        supabase.from("services").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("active", true),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("active", true),
        supabase.from("appointments").select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .neq("status", "cancelled")
          .gte("start_time", monthStart)
          .lte("start_time", monthEnd),
        supabase.from("whatsapp_instances").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      ]);

      if (profileRes.data) {
        console.log("[usePlanLimits] Profile data:", profileRes.data);
        
        // Regra Principal: Durante trial effective_plan = PRO mesmo que selected_plan = ELITE
        const trialEndStr = profileRes.data.trial_end;
        const now = new Date();
        const trialEnd = trialEndStr ? new Date(trialEndStr) : null;
        const trialActive = trialEnd && trialEnd > now;
        
        let currentPlan: PlanType = "free";
        
        const profilePlan = (profileRes.data.plan as string)?.toLowerCase();
        const effectivePlan = (profileRes.data.effective_plan as string)?.toLowerCase();
        
        if (trialActive) {
          currentPlan = "pro";
        } else if (effectivePlan && effectivePlan !== 'free') {
          currentPlan = effectivePlan as PlanType;
        } else {
          currentPlan = profilePlan as PlanType || "free";
        }
        
        setPlan(currentPlan);
        setTrialEndsAt(trialEndStr || null);
      }

      if (subRes.data) {
        console.log("[usePlanLimits] Subscription data found:", subRes.data);
        setSubscription({
          status: subRes.data.status || null,
          currentPeriodEnd: subRes.data.current_period_end || null,
          cancelAtPeriodEnd: !!subRes.data.cancel_at_period_end,
          stripeCustomerId: subRes.data.stripe_customer_id || null,
          priceId: subRes.data.price_id || null,
        });

        // Se tem assinatura ativa ou em trial no stripe, isso sobrescreve o plano do profile
        const isSubscribed = ['active', 'trialing', 'past_due'].includes(subRes.data.status || '');
        if (isSubscribed && subRes.data.price_id) {
          const planFromPrice = subRes.data.price_id.split('_')[0] as PlanType;
          if (["starter", "pro", "elite"].includes(planFromPrice)) {
            setPlan(planFromPrice);
          }
        }
      } else {
        console.log("[usePlanLimits] No subscription found for user");
      }

      setUsage({
        barbers: barbRes.count || 0,
        services: servRes.count || 0,
        products: prodRes.count || 0,
        monthlyAppointments: appRes.count || 0,
        whatsappConnections: whatsappRes.count || 0,
      });
    } catch (error) {
      console.error("[usePlanLimits] Error fetching data:", error);
    } finally {
      console.log("[usePlanLimits] Fetch complete");
      setLoading(false);
    }
  }

  const limits = (plan && PLAN_LIMITS[plan]) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free;

  const trialDaysRemaining = trialEndsAt 
    ? Math.max(0, differenceInDays(new Date(trialEndsAt), new Date()))
    : 0;

  // Logic for detailed subscription status as requested by user
  const subStatus = (subscription?.status || "").toLowerCase();

  // Rule: exists active subscription if status is 'active', 'paid', 'trialing' or 'past_due'
  // OR if explicitly marked as active in profile (using common field names or plan)
  const hasActiveSubscription = 
    ['active', 'paid', 'trialing', 'past_due'].includes(subStatus) || 
    (plan && plan !== 'free');

  const isTrialValid = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;

  // Final access rule: can access if trial is valid OR has active subscription
  // O SaaS não possui plano free. Bloqueio somente se trial expirou E não há assinatura.
  // REMOVI O BLOQUEIO DA ROTA PROFISSIONAL AQUI - ela deve ser controlada pela lógica de login do profissional
  const canAccess = hasActiveSubscription || isTrialValid;
  
  // Bloqueio APENAS se canAccess for falso
  const isExpired = !canAccess;

  useEffect(() => {
    if (!loading && tenantId) {
      console.log("%c[usePlanLimits] ACCESS LOGIC DEBUG (v8)", "background: #222; color: #bada55; font-size: 14px; padding: 4px;", {
        tenantId,
        plan,
        subscriptionStatus: subStatus,
        hasActiveSubscription,
        isTrialValid,
        canAccess,
        isExpired,
        trialEndsAt,
        shouldBeBlocked: isExpired
      });
    }
  }, [loading, tenantId, plan, subStatus, hasActiveSubscription, isTrialValid, canAccess, isExpired, trialEndsAt]);

  const checkLimit = (type: keyof typeof usage) => {
    if (!limits) return false;
    // @ts-ignore
    return usage[type] < limits[type];
  };

  return {
    plan,
    limits: limits || PLAN_LIMITS.free,
    usage,
    loading,
    trialDaysRemaining,
    trialEndsAt,
    isTrial: isTrialValid,
    isExpired,
    subscription,
    checkLimit,
    refresh: fetchPlanAndUsage,
  };
}
