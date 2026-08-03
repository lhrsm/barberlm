import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AIContextSchema, AIContext } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resolveAIContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authSupabase } = context;
    
    // 1. Fetch user role and tenant
    const { data: profile } = await authSupabase
      .from("profiles")
      .select("id, role, tenant_id")
      .eq("id", userId)
      .single();

    if (!profile) throw new Error("Profile not found");

    // 2. Fetch enabled modules
    const { data: tenantModules } = await authSupabase
      .from("tenant_modules")
      .select("module_key")
      .eq("tenant_id", profile.tenant_id);

    // 3. Check for AI Feature Flag (SaaS Admin defined or internal test)
    // For now, we allow it for super_admin or internal testing tenant
    const isSuperAdmin = profile.role === 'super_admin';
    const isInternalTest = profile.tenant_id === '00000000-0000-0000-0000-000000000000';
    
    const status = (isSuperAdmin || isInternalTest) ? "internal_testing" : "disabled";

    return {
      status,
      ai_assistant_enabled: status,
      context: {
        tenant_id: profile.tenant_id,
        user_id: userId,
        role: profile.role,
        enabled_modules: tenantModules?.map(m => m.module_key) || []
      }
    };
  });
