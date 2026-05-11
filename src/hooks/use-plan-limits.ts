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
    whatsappConnections: Infinity,
    price: 59.90,
  },
};

export function usePlanLimits() {
  const { tenantId } = useTenant();
  const [plan, setPlan] = useState<PlanType>("free");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
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

    const [profileRes, barbRes, servRes, prodRes, appRes, whatsappRes] = await Promise.all([
      supabase.from("profiles").select("plan, created_at").eq("id", tenantId).maybeSingle(),
      supabase.from("barbers").select("*", { count: "exact", head: true }).eq("user_id", tenantId).eq("active", true),
      supabase.from("services").select("*", { count: "exact", head: true }).eq("user_id", tenantId).eq("active", true),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("user_id", tenantId).eq("active", true),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("user_id", tenantId)
        .neq("status", "cancelled")
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd),
      supabase.from("whatsapp_instances").select("*", { count: "exact", head: true }).eq("user_id", tenantId),
    ]);

    if (profileRes.data) {
      const currentPlan = profileRes.data.plan as PlanType || "free";
      setPlan(currentPlan);
      
      // Calculate trial end (15 days from creation)
      if (currentPlan === "free" || currentPlan === "pro") {
        const createdAt = new Date(profileRes.data.created_at);
        const trialEnd = new Date(createdAt);
        trialEnd.setDate(createdAt.getDate() + 15);
        setTrialEndsAt(trialEnd.toISOString());
      }
    }

    setUsage({
      barbers: barbRes.count || 0,
      services: servRes.count || 0,
      products: prodRes.count || 0,
      monthlyAppointments: appRes.count || 0,
      whatsappConnections: whatsappRes.count || 0,
    });

    setLoading(false);
  }

  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  const trialDaysRemaining = trialEndsAt 
    ? Math.max(0, differenceInDays(new Date(trialEndsAt), new Date()))
    : 0;

  const isTrial = plan === "free" || (plan === "pro" && trialDaysRemaining > 0);

  const checkLimit = (type: keyof typeof usage) => {
    // @ts-ignore
    return usage[type] < limits[type];
  };

  return {
    plan,
    limits,
    usage,
    loading,
    trialDaysRemaining,
    isTrial,
    checkLimit,
    refresh: fetchPlanAndUsage,
  };
}
