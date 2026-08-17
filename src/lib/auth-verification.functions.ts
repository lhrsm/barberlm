import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendVerificationCode } from "./resend.functions";

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
      await sendVerificationCode({
        email: data.email,
        code,
        userName: data.userName
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

    // Mark as verified
    await supabaseAdmin
      .from("verification_challenges" as any)
      .update({ verified_at: new Date().toISOString() })
      .eq("id", challenge.id);

    return { success: true };
  });

export const finalizeAuthSetup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    password: z.string().min(6),
    clientId: z.string(),
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

    // 2. Create Auth User
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.name,
        phone: data.phone,
        role: 'client'
      }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        // Handle linking if needed, but for now throw error as per PRD
        throw new Error("Este e-mail já está cadastrado.");
      }
      throw authError;
    }

    const userId = authUser.user.id;

    // 3. Update Profile & Link
    // Check if profile exists for this userId (admin.createUser might create one via trigger)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

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

    // 4. Update Customer record
    await supabaseAdmin
      .from("customers")
      .update({
        user_id: userId,
        email: data.email,
        auth_migration_status: 'completed'
      })
      .eq("id", data.clientId);

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
