import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getSecurityLogs = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    // In a real scenario, context.supabase from requireSupabaseAuth would be used
    // For now, using the client-side instance or importing server-side one
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // This assumes the middleware is correctly passing the user
    // Since we don't have the middleware context fully here yet, 
    // we'll fetch the session first (simulated for server function)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { data, error } = await supabaseAdmin
      .from('security_activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return data;
  });

export const updatePassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    password: z.string().min(6),
  }))
  .handler(async ({ data }) => {
    const { error } = await supabase.auth.updateUser({
      password: data.password
    });

    if (error) throw new Error(error.message);

    // Log the event
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from('security_activity_logs').insert({
            user_id: user.id,
            event_type: 'password_changed',
            metadata: { method: 'settings' }
        });
    }

    return { success: true };
  });

export const requestEmailChange = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    newEmail: z.string().email(),
  }))
  .handler(async ({ data }) => {
    const { newEmail } = data;
    
    // 1. Check uniqueness in profiles/auth (simplified)
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle();
      
    if (existingUser) throw new Error("Este e-mail já está em uso.");

    // 2. Trigger verification via Resend (Simulated flow for Phase 6)
    // In a full implementation, we'd generate a challenge and send the email
    // For now, we'll use Supabase's built-in updateEmail if applicable, 
    // or simulate the Resend step.
    
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw new Error(error.message);

    return { success: true, message: "Um link de confirmação foi enviado para o seu novo e-mail." };
  });

export const listSessions = createServerFn({ method: "GET" })
  .handler(async () => {
    // Supabase JS client doesn't directly expose all active sessions via public API easily
    // We simulate this by returning the current session info
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    return [{
        id: session.access_token.slice(-10),
        browser: 'Chrome / Windows (Atual)',
        last_access: new Date().toISOString(),
        is_current: true
    }];
  });
