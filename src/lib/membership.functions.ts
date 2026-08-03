import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMembershipStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [subs, usage, plans] = await Promise.all([
      supabase.from("customer_subscriptions").select("*").eq("tenant_id", userId),
      supabase.from("subscription_usage_logs").select("*").eq("tenant_id", userId),
      supabase.from("subscription_plans").select("*").eq("tenant_id", userId)
    ]);

    const activeSubs = (subs.data || []).filter(s => s.status === 'active');
    const churned = (subs.data || []).filter(s => s.status === 'canceled');
    
    // Basic calculation for summary
    const totalRevenue = activeSubs.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    return {
      activeCount: activeSubs.length,
      churnCount: churned.length,
      totalRevenue,
      plansCount: (plans.data || []).length,
      usageCount: (usage.data || []).length
    };
  });

export const getMembershipDetailedAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // We would do deeper time-series aggregation here
    return { data: [] };
  });

export const updatePlanBenefit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    plan_id: z.string(),
    benefit_key: z.string(),
    benefit_name: z.string(),
    monthly_limit: z.number(),
    active: z.boolean().optional()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { plan_id, benefit_key, ...rest } = data;

    const { error } = await supabase
      .from("subscription_plan_benefits")
      .upsert({
        plan_id,
        benefit_key,
        tenant_id: userId,
        ...rest,
        updated_at: new Date().toISOString()
      }, { onConflict: 'plan_id,benefit_key' });

    if (error) throw new Error(error.message);
    return { success: true };
  });
