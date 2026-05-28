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
        supabase.from("profiles").select("plan, created_at, trial_end").eq("id", tenantId).maybeSingle(),
        supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end, stripe_customer_id, price_id").eq("user_id", tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from("barbers").select("*", { count: "exact", head: true }).eq("user_id", tenantId).eq("active", true),
        supabase.from("services").select("*", { count: "exact", head: true }).eq("user_id", tenantId).eq("active", true),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("user_id", tenantId).eq("active", true),
        supabase.from("appointments").select("*", { count: "exact", head: true })
          .eq("user_id", tenantId)
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
        
        if (trialActive) {
          currentPlan = "pro";
        } else {
          currentPlan = (profileRes.data.plan as string)?.toLowerCase() as PlanType || "free";
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

  // Plan logic:
  // 1. If active/trialing/past_due subscription exists, it's NOT expired
  // 2. Otherwise check trial days
  const isSubscribed = ['active', 'trialing', 'past_due'].includes(subscription?.status?.toLowerCase() || '');
  
  // Regras de liberação total:
  // 1. Status da assinatura é 'active', 'trialing' ou 'past_due' (isSubscribed)
  // 2. O plano não é free (significa que tem um plano selecionado/pago)
  const hasActiveSubscription = isSubscribed || (plan !== 'free' && plan !== null);
  
  const isTrial = isSubscribed || (plan === 'free' && trialDaysRemaining > 0);
  
  // Bloqueio APENAS se não houver assinatura ativa E o plano for free E o trial acabou
  // IMPORTANTE: isExpired = false libera a tela logada.
  const isExpired = !hasActiveSubscription && plan === 'free' && trialDaysRemaining <= 0;

  useEffect(() => {
    if (!loading) {
      console.log("[usePlanLimits] Access Logic Debug (v3):", {
        tenantId,
        plan,
        subscriptionStatus: subscription?.status,
        isSubscribed,
        hasActiveSubscription,
        trialDaysRemaining,
        isTrial,
        isExpired,
        trialEndsAt,
        shouldBeBlocked: isExpired
      });
    }
  }, [loading, tenantId, plan, subscription?.status, isSubscribed, hasActiveSubscription, trialDaysRemaining, isTrial, isExpired, trialEndsAt]);

  useEffect(() => {
    if (!loading) {
      console.log("[usePlanLimits] Access Logic Debug:", {
        tenantId,
        plan,
        subscriptionStatus: subscription?.status,
        isSubscribed,
        hasActiveSubscription,
        trialDaysRemaining,
        isTrial,
        isExpired,
        trialEndsAt
      });
    }
  }, [loading, tenantId, plan, subscription?.status, isSubscribed, hasActiveSubscription, trialDaysRemaining, isTrial, isExpired, trialEndsAt]);

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
    isTrial,
    isExpired,
    subscription,
    checkLimit,
    refresh: fetchPlanAndUsage,
  };
}
