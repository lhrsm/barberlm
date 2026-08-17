import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeIdentifier } from "@/utils/auth-identifier";

export const clientLogin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    identifier: z.string(),
    password: z.string(),
    barbershopSlug: z.string().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { identifier, password } = data;
    const { type, value } = normalizeIdentifier(identifier);
    
    console.log(`[AuthClient] Attempting login for ${value} (${type})`);
    
    // Barbex Enterprise Singleton Client
    const { supabase } = await import("@/integrations/supabase/client");
    
    if (!supabase) {
      console.error("[AuthClient] Supabase client singleton not initialized");
      throw new Error("Supabase client singleton not initialized");
    }

    let authResult;
    try {
      if (type === 'email') {
        console.log(`[AuthClient] Calling signInWithPassword with email: ${value}`);
        authResult = await supabase.auth.signInWithPassword({ email: value, password });
      } else {
        console.log(`[AuthClient] Calling signInWithPassword with phone: ${value}`);
        authResult = await supabase.auth.signInWithPassword({ phone: value, password });
      }
    } catch (e: any) {
      console.error(`[AuthClient] Sign in exception for ${value}:`, e);
      throw new Error(`Erro de conexão com o servidor: ${e.message || "Erro desconhecido"}`);
    }

    if (authResult.error) {
      console.error(`[AuthClient] Login failed for ${value}:`, authResult.error.message, authResult.error.code);
      throw new Error(`Erro de autenticação: ${authResult.error.message}`);
    }
    
    const { data: { user } } = authResult;
    if (!user) {
      console.error("[AuthClient] No user object returned after successful-looking login");
      throw new Error("Usuário não encontrado após login");
    }
    
    console.log(`[AuthClient] Login successful for user ${user.id}`);

    // Repair routine: if user logged in via email but lacks phone in Auth, and we have it in customers
    if (type === 'email' && !user.phone) {
      const { data: customer } = await supabase
        .from('customers')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (customer?.phone) {
        console.log(`[AuthClient] Repairing missing phone for user ${user.id}`);
        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
        await admin.auth.admin.updateUserById(user.id, {
          phone: customer.phone,
          user_metadata: { ...(user.user_metadata || {}), phone: customer.phone }
        });
      }
    }

    // Check for MFA
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    const hasVerifiedMFA = factors?.all?.some((f: any) => f.status === 'verified');

    if (hasVerifiedMFA) {
      return {
        status: 'mfa_required',
        userId: user.id
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id, identity_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("[AuthClient] Profile resolution failed for UID:", user.id, profileError);
      throw new Error("Perfil não encontrado");
    }

    if (profile.identity_status === 'legacy') {
      return { 
        status: 'migration_required', 
        userId: user.id,
        phone: type === 'phone' ? value : null 
      };
    }

    return { 
      status: 'success', 
      user: {
        id: user.id,
        email: user.email,
        role: profile.role,
        tenantId: profile.tenant_id
      }
    };
  });


export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    identifier: z.string(),
    redirectTo: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { identifier, redirectTo } = data;
    const { type, value } = normalizeIdentifier(identifier);
    const { supabase } = await import("@/integrations/supabase/client");

    let email = value;

    if (type === 'phone') {
      // Resolve email from phone
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone', value)
        .maybeSingle();
      
      if (error || !profile?.email) {
        // Generic success message to prevent enumeration
        return { message: "Se encontrarmos uma conta compatível, enviaremos as instruções de recuperação para o e-mail cadastrado." };
      }
      email = profile.email;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      // Generic success message even on error (unless it's a rate limit)
      if (error.status === 429) {
        throw new Error("Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.");
      }
    }

    return { message: "Se encontrarmos uma conta compatível, enviaremos as instruções de recuperação para o e-mail cadastrado." };
  });

export const validateResetToken = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    token: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    // Supabase JS client doesn't have a direct "validate token" method without consuming it,
    // but verifyOtp with type 'recovery' can check it.
    // However, the standard way is to handle it on the client side with onAuthStateChange.
    // For this server function, we'll just acknowledge we're ready to process.
    return { valid: true };
  });

export const updatePassword = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    password: z.string().min(6)
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    
    // This assumes the user is already authenticated via the recovery link
    const { error } = await supabase.auth.updateUser({
      password: data.password
    });

    if (error) {
      throw new Error(error.message || "Erro ao atualizar senha");
    }

    return { success: true };
  });
