import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getResendSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("resend_settings" as any)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[ResendSettings] Fetch failed:", error);
      throw new Error("Failed to fetch Resend settings");
    }

    // Check if secrets exist (server-side only check)
    const hasApiKey = !!process.env['RESEND_API_KEY'];
    const hasWebhookSecret = !!process.env['RESEND_WEBHOOK_SECRET'];

    return {
      settings: data || {
        from_name: 'Barbex',
        from_email: 'noreply@notify.barbex.shop',
        domain: 'notify.barbex.shop',
        is_domain_verified: false
      },
      secrets: {
        hasApiKey,
        hasWebhookSecret
      }
    };
  });

export const updateResendSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    from_name: z.string().min(1),
    from_email: z.string().email(),
    domain: z.string().min(1)
  }).parse(data))
  .handler(async ({ data, context }) => {
    // Check super_admin role
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = context.user;
    
    if (!user) throw new Error("Unauthorized");

    // Verify role (simple check for now, assumes has_role is available via SQL)
    const { data: roleData } = await supabaseAdmin
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) throw new Error("Permission denied. Super Admin required.");

    const { error } = await supabaseAdmin
      .from("resend_settings" as any)
      .upsert({
        ...data,
        updated_at: new Date().toISOString()
      } as any, { onConflict: 'id' });

    if (error) {
      console.error("[ResendSettings] Upsert failed:", error);
      throw new Error("Failed to update Resend settings");
    }

    return { success: true };
  });

export const validateResendIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verify super_admin role
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = context.user;
    
    if (!user) throw new Error("Unauthorized");

    const { data: roleData } = await supabaseAdmin
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) throw new Error("Permission denied. Super Admin required.");

    const RESEND_API_KEY = process.env['RESEND_API_KEY'];
    if (!RESEND_API_KEY) {
      return { success: false, error: "API Key não configurada" };
    }

    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: "Falha na comunicação com a Resend API" };
      }

      const domainsData = await response.json();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      // Get current domain from settings
      const { data: settings } = await supabaseAdmin
        .from("resend_settings" as any)
        .select("domain")
        .maybeSingle();

      const currentDomain = (settings as any)?.domain;
      const resendDomain = domainsData.data?.find((d: any) => d.name === currentDomain);

      if (resendDomain) {
        await supabaseAdmin
          .from("resend_settings" as any)
          .update({ is_domain_verified: resendDomain.status === 'verified' } as any)
          .eq("domain", currentDomain);
      }

      return { 
        success: true, 
        domains: domainsData.data,
        verified: resendDomain?.status === 'verified',
        status: resendDomain?.status || 'not_found'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
