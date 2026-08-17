import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getSecurityLogs = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', newEmail).maybeSingle();
    if (existingUser) throw new Error("Este e-mail já está em uso.");
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw new Error(error.message);
    return { success: true, message: "Um link de confirmação foi enviado para o seu novo e-mail." };
  });

export const listSessions = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    return [{
        id: session.access_token.slice(-10),
        browser: 'Chrome / Windows (Atual)',
        last_access: new Date().toISOString(),
        is_current: true
    }];
  });

export const enrollMFA = createServerFn({ method: "POST" })
  .handler(async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp'
    });
    if (error) throw new Error(error.message);
    return data;
  });

export const verifyMFA = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    factorId: z.string(),
    code: z.string().length(6),
    challengeId: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: data.factorId,
      code: data.code
    });
    if (error) throw new Error(error.message);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from('security_activity_logs').insert({
        user_id: user.id,
        event_type: 'mfa_enabled',
        metadata: { factorId: data.factorId }
      });
    }
    return { success: true };
  });

export const unenrollMFA = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    factorId: z.string(),
  }))
  .handler(async ({ data }) => {
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: data.factorId
    });
    if (error) throw new Error(error.message);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from('security_activity_logs').insert({
        user_id: user.id,
        event_type: 'mfa_disabled',
        metadata: { factorId: data.factorId }
      });
    }
    return { success: true };
  });

export const getMFAStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw new Error(error.message);
    return data;
  });

export const listFactors = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    return data;
  });

