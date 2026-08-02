import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_RECEPTION_PERMISSIONS } from "@/lib/reception-permissions";

/** Resolve o tenant do chamador e garante que ele é dono/admin da barbearia. */
async function requireOwner(context: any) {
  const { data: profile, error } = await context.supabase
    .from("profiles")
    .select("id, role, tenant_id")
    .eq("id", context.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const role = profile?.role;
  if (!profile || !["tenant_admin", "admin", "super_admin"].includes(role || "")) {
    throw new Error("Sem permissão para gerenciar usuários da recepção.");
  }
  return (profile.tenant_id || profile.id) as string;
}

export const listReceptionUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireOwner(context);

    const { data, error } = await context.supabase
      .from("reception_permissions")
      .select("id, user_id, permissions, is_active, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (data || []).map((r: any) => r.user_id);
    let profiles: any[] = [];
    if (ids.length) {
      const { data: p } = await context.supabase
        .from("profiles")
        .select("id, email, responsible_name, business_name")
        .in("id", ids);
      profiles = p || [];
    }

    return {
      items: (data || []).map((r: any) => {
        const p = profiles.find((x) => x.id === r.user_id);
        return {
          ...r,
          email: p?.email ?? null,
          name: p?.responsible_name ?? p?.business_name ?? null,
        };
      }),
    };
  });

export const createReceptionUser = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; name?: string }) => {
    const email = String(d.email || "").trim().toLowerCase();
    const password = String(d.password || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");
    if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
    return { email, password, name: (d.name || "").trim().slice(0, 120) };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const tenantId = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reaproveita usuário existente quando o e-mail já tem conta
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    let userId = existingProfile?.id as string | undefined;

    if (!userId) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { responsible_name: data.name || "Recepção" },
      });
      if (createError) throw new Error(createError.message);
      userId = created.user!.id;
    }

    await supabaseAdmin
      .from("profiles")
      .update({ role: "reception", tenant_id: tenantId, responsible_name: data.name || "Recepção" })
      .eq("id", userId);

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "reception" as any }, { onConflict: "user_id,role" });

    const { error: permError } = await supabaseAdmin
      .from("reception_permissions")
      .upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          permissions: DEFAULT_RECEPTION_PERMISSIONS,
          is_active: true,
        },
        { onConflict: "user_id" },
      );
    if (permError) throw new Error(permError.message);

    return { ok: true, user_id: userId };
  });

export const updateReceptionPermissions = createServerFn({ method: "POST" })
  .inputValidator((d: { user_id: string; permissions?: Record<string, boolean>; is_active?: boolean }) => {
    if (!d.user_id) throw new Error("Usuário inválido.");
    return d;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const tenantId = await requireOwner(context);

    const patch: { permissions?: Record<string, boolean>; is_active?: boolean } = {};
    if (data.permissions) patch.permissions = data.permissions;
    if (typeof data.is_active === "boolean") patch.is_active = data.is_active;

    const { error } = await (context.supabase as any)
      .from("reception_permissions")
      .update(patch)
      .eq("user_id", data.user_id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeReceptionUser = createServerFn({ method: "POST" })
  .inputValidator((d: { user_id: string }) => {
    if (!d.user_id) throw new Error("Usuário inválido.");
    return d;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const tenantId = await requireOwner(context);
    const { error } = await context.supabase
      .from("reception_permissions")
      .delete()
      .eq("user_id", data.user_id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
