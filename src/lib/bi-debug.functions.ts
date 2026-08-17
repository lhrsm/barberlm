
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const testBIData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    start_date: z.string(),
    end_date: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authSupabase } = context as any;
    
    if (!userId) return { success: false, error: "No userId in context", context };
    
    try {
        const { data: profile, error: profileError } = await authSupabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", userId)
          .single();

        if (profileError) return { success: false, error: "Profile fetch error", details: profileError, userId };
        if (!profile?.tenant_id) return { success: false, error: "No tenant_id in profile", profile };

        const tenantId = profile.tenant_id;

        const results: any = {};
        const tables = ["transactions", "appointments", "product_sales", "cashback_transactions", "credit_transactions", "barber_commissions"];
        
        for (const table of tables) {
            const { data: rows, error, count } = await authSupabase
                .from(table)
                .select("*", { count: "exact", head: true })
                .eq("tenant_id", tenantId)
                .limit(1);
            
            results[table] = {
                success: !error,
                error: error ? { code: error.code, message: error.message } : null,
                count: count
            };
        }

        return {
            success: true,
            userId,
            tenantId,
            results
        };
    } catch (e: any) {
        return { success: false, error: e.message, stack: e.stack };
    }
  });
