import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function serverPublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function clientMeta() {
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
    null;
  const ua = getRequestHeader("user-agent") || null;
  return { ip, user_agent: ua };
}

export const listSubprocessors = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublic();
  const { data, error } = await (sb as any).from("subprocessors")
    .select("id,name,purpose,category,country,privacy_url,website_url,logo_url,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const submitCookieConsent = createServerFn({ method: "POST" })
  .inputValidator((d: {
    necessary?: boolean;
    preferences: boolean;
    statistics: boolean;
    marketing: boolean;
    tenant_id?: string | null;
    policy_version?: string;
    source?: string;
  }) => d)
  .handler(async ({ data }) => {
    const { ip, user_agent } = clientMeta();
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { error } = await (admin as any).from("cookie_consents").insert({
      tenant_id: data.tenant_id ?? null,
      necessary: true,
      preferences: !!data.preferences,
      statistics: !!data.statistics,
      marketing: !!data.marketing,
      policy_version: data.policy_version || "2026-06-27",
      source: data.source || "web",
      ip,
      user_agent,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitLgpdRequest = createServerFn({ method: "POST" })
  .inputValidator((d: {
    request_type: "export" | "delete" | "anonymize" | "correction";
    tenant_id?: string | null;
    customer_id?: string | null;
    contact_email?: string;
    notes?: string;
    payload?: Record<string, unknown>;
  }) => d)
  .handler(async ({ data }) => {
    const { ip, user_agent } = clientMeta();
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (admin as any).from("lgpd_requests")
      .insert({
        request_type: data.request_type,
        tenant_id: data.tenant_id ?? null,
        customer_id: data.customer_id ?? null,
        contact_email: data.contact_email ?? null,
        notes: data.notes ?? null,
        payload: data.payload ?? {},
        ip,
        user_agent,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const myLgpdHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: requests } = await (context.supabase as any).from("lgpd_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: consents } = await (context.supabase as any).from("privacy_consents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return { requests: requests ?? [], consents: consents ?? [] };
  });

export const adminListLgpdRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; tenant_id?: string; type?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    let q = (admin as any).from("lgpd_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    if (data.tenant_id) q = q.eq("tenant_id", data.tenant_id);
    if (data.type) q = q.eq("request_type", data.type);
    const { data: items, error } = await q;
    if (error) throw new Error(error.message);
    return { items: items ?? [] };
  });

export const adminResolveLgpdRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "in_progress" | "done" | "rejected"; response?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { error } = await (admin as any).from("lgpd_requests")
      .update({
        status: data.status,
        response: data.response ? { note: data.response } : null,
        resolved_at: data.status === "done" || data.status === "rejected" ? new Date().toISOString() : null,
        resolved_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
