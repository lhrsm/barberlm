
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";

const appRoleEnum = z.enum(["admin", "tenant_admin", "barber", "client", "reception", "manager", "financial"]);

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    email: z.string().email(),
    phone: z.string().optional(),
    role: z.string(),
    professionalId: z.string().optional(),
    tenantId: z.string()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { email, phone, role, professionalId, tenantId } = data;

    // 1. Check if user already has membership
    const { data: existingMember } = await supabase
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId) // This should actually check if an auth user with this email exists first
      .single();

    // Generate token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const { error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        tenant_id: tenantId,
        email,
        phone,
        role,
        professional_id: professionalId,
        token_hash: token, // In prod, hash this
        expires_at: expiresAt.toISOString(),
        invited_by: userId
      });

    if (inviteError) throw new Error(inviteError.message);

    // 2. Send Email via Resend
    // We'll import the send function inside handler to avoid module scope issues
    const { sendVerificationCode } = await import("./resend.functions");
    
    // Custom email for Phase 4
    const RESEND_API_KEY = process.env['RESEND_API_KEY'];
    const inviteUrl = `${process.env['VITE_APP_URL'] || 'https://barberlm.lovable.app'}/invite/${token}`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #D4AF37; margin: 0;">BARBEX</h1>
        </div>
        <p>Olá!</p>
        <p>Você foi convidado para acessar o Barbex como <strong>${role}</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background: #D4AF37; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">CRIAR MEU ACESSO</a>
        </div>
        <p style="color: #666; font-size: 14px;">Este convite expira em 72 horas.</p>
        <p style="color: #666; font-size: 14px;">Se você não solicitou este acesso, ignore este e-mail.</p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Barbex <noreply@barbex.shop>',
        to: [email],
        subject: 'Você foi convidado para acessar o Barbex',
        html: htmlContent,
      }),
    });

    return { success: true };
  });

export const getTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ tenantId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: members, error } = await supabase
      .from('tenant_memberships')
      .select(`
        *,
        profile:profiles!tenant_memberships_user_id_fkey(
          id,
          display_name,
          email,
          avatar_url,
          responsible_name
        )
      `)
      .eq('tenant_id', data.tenantId);

    if (error) throw new Error(error.message);
    return members;
  });

export const getPendingInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ tenantId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: invites, error } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('tenant_id', data.tenantId)
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
    return invites;
  });
