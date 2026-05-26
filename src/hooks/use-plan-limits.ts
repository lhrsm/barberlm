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
        supabase.from("profiles").select("plan, created_at").eq("id", tenantId).maybeSingle(),
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
        const currentPlan = (profileRes.data.plan as string)?.toLowerCase() as PlanType || "free";
        setPlan(currentPlan);
        
        // Calculate trial end (15 days from creation as fallback)
        const createdAtStr = profileRes.data.created_at;
        const createdAt = createdAtStr ? new Date(createdAtStr) : new Date();
        const trialEnd = new Date(createdAt);
        trialEnd.setDate(createdAt.getDate() + 15);
        setTrialEndsAt(trialEnd.toISOString());
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

        // If status is 'trialing' and we have current_period_end, that is our actual trial end from Stripe
        if (subRes.data.status === 'trialing' && subRes.data.current_period_end) {
          setTrialEndsAt(subRes.data.current_period_end);
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
  // 1. If active/trialing subscription exists, prioritize that
  // 2. Otherwise use profile plan
  const isTrial = (subscription?.status === 'trialing') || (plan === 'free' && trialDaysRemaining > 0);
  const isExpired = plan === 'free' && trialDaysRemaining <= 0 && subscription?.status !== 'active';

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
