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
    
    // We use the supabase client from context (provided by middleware)
    // In TanStack Start with Supabase, the context should have the supabase client
    const { supabase } = context as any;
    
    if (!supabase) {
      throw new Error("Supabase client not found in context");
    }

    let authResult;
    
    if (type === 'email') {
      authResult = await supabase.auth.signInWithPassword({
        email: value,
        password: password,
      });
    } else {
      authResult = await supabase.auth.signInWithPassword({
        phone: value,
        password: password,
      });
    }

    if (authResult.error) {
      // Return a generic error to prevent enumeration
      throw new Error("Credenciais inválidas");
    }

    const { data: { user } } = authResult;
    
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Check if user is a client and get their status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, auth_setup_status, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Perfil não encontrado");
    }

    // Check if it's a legacy client
    if (profile.auth_setup_status === 'legacy') {
      // In a real scenario, we might want to sign them out or return a specific status
      // to trigger the migration flow on the frontend.
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
    const { supabase } = context as any;

    let email = value;

    if (type === 'phone') {
      // Resolve email from phone
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone', value)
        .single();
      
      if (error || !profile?.email) {
        // Generic success message to prevent enumeration
        return { message: "Se encontrarmos uma conta compatível, enviaremos as instruções." };
      }
      email = profile.email;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      // Generic success message even on error (unless it's a rate limit)
      if (error.status === 429) {
        throw new Error("Muitas tentativas. Aguarde alguns minutos.");
      }
    }

    return { message: "Se encontrarmos uma conta compatível, enviaremos as instruções." };
  });
