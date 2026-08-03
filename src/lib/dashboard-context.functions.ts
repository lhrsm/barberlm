import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resolveDashboardContext = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    // 1. Get user session from auth-middleware (injected by attachSupabaseAuth)
    // In TanStack Start, context.supabase is available if middleware is used.
    // However, for this core resolver, we'll use the user ID from the request context
    // which is populated by the auth attacher.
    
    const userId = (context as any).userId;
    if (!userId) {
      return { role: 'guest', permissions: [] };
    }

    // 2. Fetch profile and role in a single privileged call to avoid RLS circularity during context resolution
    const [{ data: profile }, { data: userRole }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("tenant_id, business_name, slug, role")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle()
    ]);

    const role = userRole?.role || profile?.role || 'client';
    const tenantId = profile?.tenant_id;

    // 3. Fetch active modules and plan if tenant exists
    let modules: string[] = [];
    let plan = 'free';
    if (tenantId) {
      const { data: tenantModules } = await supabaseAdmin
        .from("tenant_modules")
        .select("module_key")
        .eq("tenant_id", tenantId)
        .eq("enabled", true);
      
      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("plan_id, status")
        .eq("user_id", tenantId)
        .eq("status", "active")
        .maybeSingle();

      modules = tenantModules?.map(m => m.module_key) || [];
      plan = subscription?.plan_id || 'free';
    }

    // 4. Map role to allowed dashboard sections and default routes
    const dashboardMap: Record<string, { route: string, sections: string[] }> = {
      'super_admin': { 
        route: '/admin/dashboard', 
        sections: ['saas_health', 'platform_usage', 'technical_health', 'admin_alerts'] 
      },
      'admin': { 
        route: '/dashboard', 
        sections: ['executive_summary', 'daily_operation', 'alerts', 'shortcuts'] 
      },
      'tenant_admin': { 
        route: '/dashboard', 
        sections: ['executive_summary', 'daily_operation', 'alerts', 'shortcuts'] 
      },
      'manager': { 
        route: '/dashboard', 
        sections: ['daily_operation', 'team_performance', 'stock_alerts'] 
      },
      'reception': { 
        route: '/reception', 
        sections: ['queue', 'daily_agenda', 'checkins', 'walkins'] 
      },
      'barber': { 
        route: '/profissional', 
        sections: ['my_agenda', 'my_performance', 'my_reviews'] 
      },
      'client': { 
        route: '/portal', 
        sections: ['next_appointment', 'benefits', 'loyalty', 'journey'] 
      }
    };

    const contextConfig = dashboardMap[role] || dashboardMap['client'];

    return {
      userId,
      tenantId,
      businessName: profile?.business_name,
      slug: profile?.slug,
      role,
      plan,
      modules,
      allowedSections: contextConfig.sections,
      defaultRoute: contextConfig.route,
      timestamp: new Date().toISOString()
    };
  });
