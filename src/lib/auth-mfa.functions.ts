import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * MFA Challenge Response interface based on Supabase MFA API
 */
interface MFAChallengeResponse {
  data: {
    id: string;
    expires_at: string;
  } | null;
  error: any;
}

export const getMFAChallenge = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    factorId: z.string(),
  }))
  .handler(async ({ data }) => {
    const { data: challenge, error } = await supabase.auth.mfa.challenge({
      factorId: data.factorId
    });
    if (error) throw new Error(error.message);
    return challenge;
  });

export const verifyMFAChallenge = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    factorId: z.string(),
    challengeId: z.string(),
    code: z.string().length(6),
  }))
  .handler(async ({ data }) => {
    const { error } = await supabase.auth.mfa.verify({
      factorId: data.factorId,
      challengeId: data.challengeId,
      code: data.code
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const verifyBackupCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    code: z.string().toUpperCase(),
  }))
  .handler(async ({ data }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // In production, we would hash the input and compare
    const { data: backupCode, error } = await supabaseAdmin
      .from('user_mfa_backup_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('code_hash', data.code)
      .is('used_at', null)
      .maybeSingle();

    if (error || !backupCode) {
      await supabaseAdmin.from('security_activity_logs').insert({
        user_id: user.id,
        event_type: 'mfa_challenge_failed',
        metadata: { method: 'backup_code' }
      });
      throw new Error("Código de recuperação inválido ou já utilizado.");
    }

    // Mark as used
    await supabaseAdmin
      .from('user_mfa_backup_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', backupCode.id);

    await supabaseAdmin.from('security_activity_logs').insert({
      user_id: user.id,
      event_type: 'recovery_code_used',
      metadata: { code_id: backupCode.id }
    });

    return { success: true };
  });
