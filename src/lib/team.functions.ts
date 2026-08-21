
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
    // 0. Authorization check: Caller must be owner, admin or manager of tenantId
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const isOwner = userId === tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin' && callerRole !== 'manager') {
      throw new Error("Acesso negado: você não possui permissão para gerenciar a equipe deste estabelecimento.");
    }

    // Prevenção de escalação de privilégios:
    if (role === 'super_admin' && callerProfile?.role !== 'super_admin') {
      throw new Error("Não é permitido convidar administradores globais.");
    }
    if (callerRole === 'manager' && (role === 'admin' || role === 'tenant_admin' || role === 'super_admin')) {
      throw new Error("Gerentes não podem convidar administradores.");
    }

    // 1. Check if user already has membership
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      const { data: membership } = await supabase
        .from('tenant_memberships')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', existingUser.id)
        .maybeSingle();
      
      if (membership) throw new Error("Este usuário já faz parte desta barbearia.");
    }

    // Generate token
    const token = randomBytes(32).toString('hex');
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
    const { sendTransactionalEmail } = await import("./resend.functions");
    
    const inviteUrl = `${process.env['VITE_APP_URL'] || 'https://barberlm.lovable.app'}/invite/${token}`;

    const { data: tenant } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', tenantId)
      .maybeSingle();

    await sendTransactionalEmail({
      data: {
        recipient: email,
        templateKey: 'internal_user_invitation',
        templateData: {
          barbershopName: tenant?.display_name || 'Barbex',
          role,
          inviteUrl
        },
        tenantId,
        userId
      }
    });

    return { success: true };
  });

export const getTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ tenantId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // Caller authorization: must be admin or manager of tenantId
    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', data.tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const isOwner = userId === data.tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin' && callerRole !== 'manager') {
      throw new Error("Acesso negado: você não tem permissão para visualizar os membros da equipe.");
    }

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
    const { supabase, userId } = context as any;

    // Caller authorization: must be admin or manager of tenantId
    const { data: callerMembership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', data.tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const isOwner = userId === data.tenantId || callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin' || callerProfile?.role === 'tenant_admin';
    const callerRole = isOwner ? 'admin' : (callerMembership?.role || callerProfile?.role);

    if (!isOwner && callerRole !== 'admin' && callerRole !== 'tenant_admin' && callerRole !== 'manager') {
      throw new Error("Acesso negado: você não tem permissão para visualizar convites pendentes.");
    }

    const { data: invites, error } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('tenant_id', data.tenantId)
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
    return invites;
  });

export const acceptTeamInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    password: z.string().min(6)
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { token, password } = data;

    // 1. Validate Invitation
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .eq('token_hash', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) throw new Error("Convite inválido ou expirado.");

    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      throw new Error("Este convite expirou.");
    }

    // 2. Check if Auth User exists
    const { data: authData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw new Error("Erro ao verificar usuários.");
    let user = authData.users.find(u => u.email === invite.email);

    if (!user) {
      // Create Auth User
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          role: invite.role,
          tenant_id: invite.tenant_id
        }
      });
      if (createError) throw new Error(createError.message);
      user = newUser.user;
    }

    // 3. Link Membership & Profile
    const { error: membershipError } = await supabaseAdmin
      .from('tenant_memberships')
      .upsert({
        tenant_id: invite.tenant_id,
        user_id: user.id,
        role: invite.role,
        status: 'active'
      });

    if (membershipError) throw new Error(membershipError.message);

    // 4. Update Invitation Status
    await supabaseAdmin
      .from('user_invitations')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id
      } as any)
      .eq('id', invite.id);

    return { success: true };
  });

