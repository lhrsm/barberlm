import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./use-tenant";
import { startOfMonth, endOfMonth } from "date-fns";

export type PlanType = "free" | "basic" | "intermediate" | "pro";

export const PLAN_LIMITS = {
  free: {
    barbers: 1,
    services: 5,
    products: 5,
    monthlyAppointments: 30,
    whatsappConnections: 1,
    hasTrial: true,
    trialDays: 7,
  },
  basic: {
    barbers: 2,
    services: 10,
    products: 25,
    monthlyAppointments: 100,
    whatsappConnections: 1,
    price: 19.90,
  },
  intermediate: {
    barbers: 5,
    services: 25,
    products: 100,
    monthlyAppointments: 500,
    whatsappConnections: 3,
    price: 39.90,
  },
  pro: {
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
    }
  }, [tenantId]);

  async function fetchPlanAndUsage() {
    if (!tenantId) return;
    setLoading(true);

    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const [profileRes, barbRes, servRes, prodRes, appRes, whatsappRes] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", tenantId).maybeSingle(),
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
      setPlan(profileRes.data.plan as PlanType || "free");
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

  const limits = PLAN_LIMITS[plan];

  const checkLimit = (type: keyof typeof usage) => {
    return usage[type] < limits[type];
  };

  return {
    plan,
    limits,
    usage,
    loading,
    checkLimit,
    refresh: fetchPlanAndUsage,
  };
}
