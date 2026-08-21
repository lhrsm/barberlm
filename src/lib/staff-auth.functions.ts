import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmail } from "./resend.functions";

/**
 * Solicita envio de código OTP de 6 dígitos para verificação de e-mail do colaborador/barbeiro
 */
export const requestStaffEmailVerification = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    phone: z.string(),
    barberId: z.string().uuid(),
    tenantId: z.string(),
    barberName: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Validar que o barbeiro existe e está vinculado ao tenant
    const { data: barber, error: barberError } = await supabaseAdmin
      .from("barbers")
      .select("id, name, tenant_id, user_id, active")
      .eq("id", data.barberId)
      .maybeSingle();

    if (barberError || !barber) {
      throw new Error("Colaborador não encontrado.");
    }

    // 2. Checar colisão de e-mail com o proprietário/administrador da barbearia
    const { data: tenantProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", data.tenantId)
      .maybeSingle();

    if (tenantProfile?.email && tenantProfile.email.toLowerCase() === data.email.toLowerCase()) {
      throw new Error("Conflito: este e-mail já pertence ao administrador da barbearia.");
    }

    // 3. Checar se outro barbeiro deste ou de outro tenant já usa esse e-mail
    const { data: otherBarber } = await supabaseAdmin
      .from("barbers")
      .select("id, name")
      .eq("email", data.email)
      .neq("id", data.barberId)
      .maybeSingle();

    if (otherBarber) {
      throw new Error(`Conflito: este e-mail já está em uso pelo profissional ${otherBarber.name}.`);
    }

    // 3.5 Checar se já existe conta no Supabase Auth por e-mail
    const listRes = await supabaseAdmin.auth.admin.listUsers();
    const users = listRes?.data?.users || [];
    const existingUser = users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    const emailExists = !!existingUser;

    // 4. Gerar código numérico OTP de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

    // 5. Gravar desafio na tabela de verificação
    const { error: insertError } = await supabaseAdmin
      .from("verification_challenges" as any)
      .insert({
        email: data.email,
        client_id: data.barberId,
        code_hash: code,
        expires_at: expiresAt,
        purpose: "staff_email_verification",
      });

    if (insertError) {
      console.error("[StaffAuth] Erro ao gravar challenge:", insertError);
      throw new Error("Falha ao gerar código de verificação.");
    }

    // 6. Enviar e-mail transacional via Resend
    try {
      await sendTransactionalEmail({
        data: {
          recipient: data.email,
          templateKey: "email_verification_code",
          templateData: {
            code,
            userName: data.barberName,
          },
        },
      });
      return { success: true, emailExists };
    } catch (sendErr) {
      console.error("[StaffAuth] Erro ao enviar e-mail com código:", sendErr);
      throw new Error("Não foi possível enviar o e-mail de verificação.");
    }
  });

/**
 * Valida o código OTP de 6 dígitos digitado pelo colaborador
 */
export const verifyStaffEmailCode = createServerFn({ method: "POST" })
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
      .eq("purpose", "staff_email_verification")
      .gt("expires_at", new Date().toISOString())
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !challenge) {
      return { success: false, error: "Código inválido ou expirado." };
    }

    // Marcar desafio como verificado
    await supabaseAdmin
      .from("verification_challenges" as any)
      .update({ verified_at: new Date().toISOString() })
      .eq("id", (challenge as any).id);

    return { success: true };
  });

/**
 * Finaliza a migração/configuração do acesso do colaborador:
 * - Cria/atualiza auth.users com e-mail e senha
 * - Vincula barbers.user_id, barbers.email e auth_migration_status
 * - Garante profiles, tenant_memberships e user_roles com role = 'barber'
 * - PRESERVA 100% o barber.id imutável
 */
export const finalizeStaffAuthSetup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    password: z.string().min(6).optional(),
    barberId: z.string().uuid(),
    phone: z.string(),
    name: z.string(),
    tenantId: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Validar que o desafio foi previamente verificado
    const { data: challenge } = await supabaseAdmin
      .from("verification_challenges" as any)
      .select("id, client_id, expires_at, verified_at")
      .eq("email", data.email)
      .eq("purpose", "staff_email_verification")
      .not("verified_at", "is", null)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challenge) {
      throw new Error("E-mail não verificado ou código expirado.");
    }

    if ((challenge as any).client_id && (challenge as any).client_id !== data.barberId) {
      throw new Error("Conflito de identificação do colaborador.");
    }

    // 2. Verificar se já existe usuário no Supabase Auth por e-mail
    const listRes = await supabaseAdmin.auth.admin.listUsers();
    const users = listRes?.data?.users || [];
    const existingUser = users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());

    let userId: string;
    let newlyCreatedAuthUserId: string | null = null;

    if (!existingUser) {
      if (!data.password || data.password.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres para novas contas.");
      }
      // Criar novo usuário no Supabase Auth
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        phone: data.phone,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.name,
          phone: data.phone,
          role: "barber",
          barber_id: data.barberId,
          tenant_id: data.tenantId,
        },
      });

      if (createError || !newUser?.user) {
        throw createError || new Error("Erro ao criar credenciais de autenticação.");
      }
      userId = newUser.user.id;
      newlyCreatedAuthUserId = userId;
    } else {
      userId = existingUser.id;
      // Não sobrescrevemos a senha de usuário pré-existente (ex: cliente); apenas garantimos metadata adicional
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingUser.user_metadata,
          full_name: data.name,
          phone: data.phone,
          barber_id: data.barberId,
          tenant_id: data.tenantId,
        },
      });
    }

    try {
      // 3. Atualizar tabela BARBERS (PRESERVANDO integralmente o barber.id)
      const { error: barberUpdateError } = await supabaseAdmin
        .from("barbers")
        .update({
          user_id: userId,
          email: data.email,
          auth_migration_status: "completed",
        } as any)
        .eq("id", data.barberId);

      if (barberUpdateError) {
        console.error("[StaffAuth] Erro ao vincular barbeiro:", barberUpdateError);
        throw new Error("Falha ao vincular perfil do profissional.");
      }

      // 4. Criar/Atualizar PROFILES
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      if (existingProfile) {
        // Se o perfil existente já for client, preservamos o papel base e garantimos o vínculo de membership
        const newRole = existingProfile.role === 'client' ? 'client' : 'barber';
        await supabaseAdmin
          .from("profiles")
          .update({
            responsible_name: data.name,
            display_name: data.name,
            email: data.email,
            role: newRole,
            identity_status: "completed",
            tenant_id: data.tenantId,
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
            role: "barber",
            identity_status: "completed",
            tenant_id: data.tenantId,
          });
      }

      // 5. Vincular TENANT_MEMBERSHIPS (role específico para o tenant)
      await supabaseAdmin
        .from("tenant_memberships")
        .upsert({
          tenant_id: data.tenantId,
          user_id: userId,
          role: "barber",
          status: "active",
        });

      // 6. Vincular USER_ROLES
      await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: "barber",
        } as any);

      // 7. Anti-Replay: Excluir o desafio de verificação consumido
      await supabaseAdmin
        .from("verification_challenges" as any)
        .delete()
        .eq("id", (challenge as any).id);

      return { success: true, userId, barberId: data.barberId };
    } catch (err: any) {
      // Compensação transacional: se o usuário foi criado nesta execução e o vínculo falhou, remove o usuário órfão
      if (newlyCreatedAuthUserId) {
        console.warn("[StaffAuth] Compensando falha: removendo auth.users órfão", newlyCreatedAuthUserId);
        try {
          await supabaseAdmin.auth.admin.deleteUser(newlyCreatedAuthUserId);
        } catch (cleanupErr) {
          console.error("[StaffAuth] Erro ao deletar auth user órfão:", cleanupErr);
        }
      }
      throw err;
    }
  });
