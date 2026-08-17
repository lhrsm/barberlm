import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "./resend.functions";

/**
 * Re-exporting MFA and Security functions for complete Etapa 7 implementation
 */


export const getSecurityLogs = createServerFn({ method: "GET" })
  .handler(async () => {
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
    // Usar singleton supabase que carrega a sessão via cookies
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !authUser) {
      throw new Error("Não autorizado: sessão inválida.");
    }

    const { error } = await supabase.auth.updateUser({
      password: data.password
    });
    if (error) throw new Error(error.message);

    // Re-buscar para logar e enviar e-mail
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from('security_activity_logs').insert({
            user_id: user.id,
            event_type: 'password_changed',
            metadata: { method: 'settings' }
        });
        
        await sendTransactionalEmail({
          data: {
            recipient: user.email!,
            templateKey: 'security_alert',
            variables: {
              subject: 'Sua senha foi alterada',
              message: 'Detectamos uma alteração de senha na sua conta Barbex. Se não foi você, entre em contato imediatamente.'
            }
          }
        });
    }

    return { success: true };
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
    const { data: verifyData, error } = await supabase.auth.mfa.challenge({
      factorId: data.factorId
    });
    
    if (error) throw new Error(error.message);

    const { error: authError } = await supabase.auth.mfa.verify({
      factorId: data.factorId,
      challengeId: verifyData.id,
      code: data.code
    });

    if (authError) throw new Error(authError.message);
    return { success: true };
  });

export const unenrollMFA = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    factorId: z.string()
  }))
  .handler(async ({ data }) => {
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: data.factorId
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
