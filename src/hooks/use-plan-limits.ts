import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { startOfMonth, endOfMonth } from "date-fns";

export type PlanType = "free" | "pro";

export const PLAN_LIMITS = {
  free: {
    barbers: 1,
    services: 5,
    monthlyAppointments: 30,
  },
  pro: {
    barbers: Infinity,
    services: Infinity,
    monthlyAppointments: Infinity,
  },
};

export function usePlanLimits() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanType>("free");
  const [usage, setUsage] = useState({
    barbers: 0,
    services: 0,
    monthlyAppointments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPlanAndUsage();
    }
  }, [user]);

  async function fetchPlanAndUsage() {
    if (!user) return;
    setLoading(true);

    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const [profileRes, barbRes, servRes, appRes] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).single(),
      supabase.from("barbers").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("active", true),
      supabase.from("services").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("active", true),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd),
    ]);

    if (profileRes.data) {
      setPlan(profileRes.data.plan as PlanType || "free");
    }

    setUsage({
      barbers: barbRes.count || 0,
      services: servRes.count || 0,
      monthlyAppointments: appRes.count || 0,
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
