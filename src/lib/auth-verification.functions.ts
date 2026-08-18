import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmail } from "./resend.functions";

export const requestEmailVerification = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    clientId: z.string().optional(),
    userName: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store in verification_challenges table (needs to be created)
    const { error } = await supabaseAdmin
      .from("verification_challenges" as any)
      .insert({
        email: data.email,
        client_id: data.clientId,
        code_hash: code, // In a real app, use a hash. For this step, we store plain as it's a short-lived code.
        expires_at: expiresAt,
        purpose: 'email_verification'
      });

    if (error) {
      console.error("[AuthVerification] Failed to store challenge:", error);
      throw new Error("Failed to generate verification code");
    }

    // Send via Resend
    try {
      await sendTransactionalEmail({
        data: {
          recipient: data.email,
          templateKey: 'email_verification_code',
          templateData: {
            code,
            userName: data.userName
          }
        }
      });
      return { success: true };
    } catch (sendError) {
      console.error("[AuthVerification] Failed to send email:", sendError);
      throw new Error("Failed to send verification email");
    }
  });

export const verifyEmailCode = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    code: z.string().length(6),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: challenge, error } = await supabaseAdmin
      .from("verification_challenges" as any)
      .select("*")
      .eq("email", data.email)
      .eq("code_hash", data.code)
      .gt("expires_at", new Date().toISOString())
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !challenge) {
      return { success: false, error: "Código inválido ou expirado" };
    }

    const challengeData = challenge as any;

    // Mark as verified
    await supabaseAdmin
      .from("verification_challenges" as any)
      .update({ verified_at: new Date().toISOString() })
      .eq("id", challengeData.id);

    return { success: true };
  });

export const finalizeAuthSetup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    password: z.string().min(6),
    clientId: z.string().nullable(),
    phone: z.string(),
    name: z.string(),
    tenantId: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Check if verification was done
    const { data: challenge } = await supabaseAdmin
      .from("verification_challenges" as any)
      .select("id")
      .eq("email", data.email)
      .not("verified_at", "is", null)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challenge) {
      throw new Error("E-mail não verificado");
    }

    // 2. Resolve or Create Auth User
    // First, check if this customer already has a valid auth_user_id
    let targetUserId: string | null = null;
    
    if (data.clientId) {
      console.log('[BOOKING_ONBOARDING_TRACE] Resolving user for clientId:', data.clientId);
      const { data: customer, error: custError } = await supabaseAdmin
        .from("customers")
        .select("user_id, tenant_id")
        .eq("id", data.clientId)
        .maybeSingle();

      if (custError) {
        console.error('[BOOKING_ONBOARDING_TRACE] Error fetching customer:', custError);
      }

      if (customer) {
        // Blindagem: Check for owner contamination
        if (customer.user_id === customer.tenant_id) {
          console.error("[AuthVerification] Identity collision detected: Customer pointing to owner ID", {
            clientId: data.clientId,
            ownerId: customer.tenant_id
          });
          // Clear the corrupt link first
          await supabaseAdmin
            .from("customers")
            .update({ user_id: null, auth_migration_status: 'legacy' })
            .eq("id", data.clientId);
        } else {
          targetUserId = customer.user_id;
        }
      }
    }

    // If we don't have a targetUserId, try to find an existing user by email
    if (!targetUserId) {
      const listRes = await supabaseAdmin.auth.admin.listUsers();
      const users = listRes?.data?.users || [];
      const existingUser = users.find(u => u.email === data.email);
      
      if (existingUser) {
        // Double check: Never allow taking over the owner account
        if (existingUser.id === data.tenantId) {
          console.error("[AuthVerification] AUTH_IDENTITY_COLLISION: Attempted to use owner account for customer onboarding", {
            email: data.email,
            tenantId: data.tenantId
          });
          throw new Error("Conflito de identidade: este e-mail pertence ao administrador.");
        }
        targetUserId = existingUser.id;
      }
    }

    let userId: string;

    if (!targetUserId) {
      // Create New Auth User
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        phone: data.phone,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.name,
          phone: data.phone,
          phone_normalized: data.phone,
          identifier: data.email,
          role: 'client'
        }
      });

      if (authError || !authUser?.user) {
        if (authError?.message?.includes("already registered")) {
          throw new Error("Este e-mail já está cadastrado.");
        }
        throw authError || new Error("Falha ao criar usuário de autenticação.");
      }
      userId = authUser.user.id;
    } else {
      // Update existing user password safely using admin API
      userId = targetUserId;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        user_metadata: {
          full_name: data.name,
          phone: data.phone,
          phone_normalized: data.phone,
          role: 'client'
        }
      });

      if (updateError) {
        throw new Error(`Erro ao atualizar credenciais: ${updateError.message}`);
      }
    }

    // 3. Update Profile & Link
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, identity_status")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile?.identity_status === 'completed') {
      // Idempotency check
      console.log("[AuthVerification] Identity already configured for", userId);
    }

    if (existingProfile) {
      await supabaseAdmin
        .from("profiles")
        .update({
          responsible_name: data.name,
          display_name: data.name,
          email: data.email,
          role: 'client',
          identity_status: 'completed',
          tenant_id: data.tenantId
        })
        .eq("id", userId);
    } else {
      await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
          responsible_name: data.name,
          display_name: data.name,
          email: data.email,
          role: 'client',
          identity_status: 'completed',
          tenant_id: data.tenantId
        });
    }

    // 4. Update Customer record if clientId is provided
    if (data.clientId) {
      await supabaseAdmin
        .from("customers")
        .update({
          user_id: userId,
          email: data.email,
          auth_migration_status: 'completed'
        })
        .eq("id", data.clientId);
    } else {
      // Try to find customer by phone and link it
      const { data: customerByPhone } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("phone", data.phone)
        .eq("tenant_id", data.tenantId)
        .maybeSingle();

      if (customerByPhone) {
        await supabaseAdmin
          .from("customers")
          .update({
            user_id: userId,
            email: data.email,
            auth_migration_status: 'completed'
          })
          .eq("id", customerByPhone.id);
      }
    }

    // 5. Create membership
    await supabaseAdmin
      .from("tenant_memberships")
      .upsert({
        tenant_id: data.tenantId,
        user_id: userId,
        role: 'client',
        status: 'active'
      });

    return { success: true, userId };
  });
