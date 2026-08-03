import { createServerFn } from "@tanstack/react-start";

const getAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

export const resolveDashboardContext = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const userId = (context as any).userId;
    if (!userId) {
      return { role: 'guest', permissions: [] };
    }

    const admin = await getAdmin();

    const [{ data: profile }, { data: userRole }] = await Promise.all([
      admin
        .from("profiles")
        .select("tenant_id, business_name, slug, role")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle()
    ]);

    const role = userRole?.role || profile?.role || 'client';
    const tenantId = profile?.tenant_id;

    let modules: string[] = [];
    let plan = 'free';
    
    if (tenantId) {
      const { data: tenantModules } = await admin
        .from("barbershop_modules" as any)
        .select("module_key")
        .eq("tenant_id", tenantId)
        .eq("enabled", true);
      
      const { data: subscription } = await admin
        .from("subscriptions")
        .select("price_id, billing_status")
        .eq("user_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      modules = tenantModules?.map((m: any) => m.module_key) || [];
      
      if (subscription?.price_id) {
        plan = String(subscription.price_id).split('_')[0].toLowerCase();
      } else if (profile?.role === 'admin' || profile?.role === 'tenant_admin') {
        // Fallback or trial check could go here
        plan = 'trial';
      }
    }

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
