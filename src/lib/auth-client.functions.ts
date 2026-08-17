import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeIdentifier } from "@/utils/auth-identifier";
import { supabase } from "@/integrations/supabase/client";

export const clientLogin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    identifier: z.string(),
    password: z.string(),
    barbershopSlug: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { identifier, password } = data;
    const { type, value } = normalizeIdentifier(identifier);
    
    console.log(`[AuthClient] Attempting login for ${value} (${type})`);
    
    // We must use the standard supabase client in server functions for TanStack Start 
    // to correctly manage the authentication cookies in the response.
    if (!supabase) {
      throw new Error("Supabase client singleton not initialized");
    }

    let authResult;
    try {
      if (type === 'email') {
        authResult = await supabase.auth.signInWithPassword({ email: value, password });
      } else {
        authResult = await supabase.auth.signInWithPassword({ phone: value, password });
      }
    } catch (e: any) {
      console.error(`[AuthClient] Sign in exception for ${value}:`, e);
      throw new Error(`Erro de conexão com o servidor: ${e.message || "Erro desconhecido"}`);
    }

    if (authResult.error) {
      console.error(`[AuthClient] Login failed for ${value}:`, authResult.error.message);
      throw new Error(`Erro de autenticação: ${authResult.error.message}`);
    }
    
    return { 
      session: authResult.data.session,
      user: authResult.data.user
    };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email()
  }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.VITE_APP_URL || 'https://barberlm.lovable.app'}/auth/reset-password`,
    });

    if (error) {
      if (error.status === 429) {
        throw new Error("Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.");
      }
      throw new Error(error.message);
    }

    return { message: "Se encontrarmos uma conta compatível, enviaremos as instruções de recuperação para o e-mail cadastrado." };
  });

export const validateResetToken = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    token: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    return { valid: true };
  });

export const updatePassword = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    password: z.string().min(6)
  }).parse(data))
  .handler(async ({ data }) => {
    // Blindagem: Usar o singleton supabase que é injetado com cookies pelo middleware
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("[AuthClient] Tentativa de updatePassword sem sessão válida", userError);
      throw new Error("Sessão expirada ou inválida. Por favor, solicite um novo link de recuperação.");
    }

    const { error } = await supabase.auth.updateUser({
      password: data.password
    });

    if (error) {
      console.error("[AuthClient] Erro ao atualizar senha via updateUser", error);
      throw new Error(error.message || "Erro ao atualizar senha");
    }

    return { success: true };
  });
