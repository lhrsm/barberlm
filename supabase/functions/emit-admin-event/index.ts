import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmitBody {
  event_key: string;
  severity?: "info" | "warning" | "critical";
  title: string;
  message?: string;
  tenant_id?: string;
  action_url?: string;
  payload?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const channelsDelivered: Record<string, number> = { panel: 0, push: 0, whatsapp: 0, email: 0 };
  let recipientsCount = 0;
  let errorMsg: string | null = null;

  try {
    const body = (await req.json()) as EmitBody;
    const {
      event_key,
      severity = "info",
      title: rawTitle,
      message: rawMessage = "",
      tenant_id,
      action_url,
      payload = {},
    } = body;

    if (!event_key || !rawTitle) throw new Error("event_key and title are required");

    // Renderiza template do banco (se existir). Fallback = title/message do body.
    let title = rawTitle;
    let message = rawMessage;
    try {
      const { data: rendered } = await supabase.rpc("render_admin_template", {
        _event_key: event_key,
        _payload: payload,
        _fallback_title: rawTitle,
        _fallback_message: rawMessage,
      });
      const row = Array.isArray(rendered) ? rendered[0] : rendered;
      if (row?.title) title = row.title;
      if (row?.message) message = row.message;
    } catch (e) {
      console.warn("[emit-admin-event] render template failed", (e as Error).message);
    }

    console.log("[emit-admin-event]", event_key, severity);

    // 1) Find all super admin users
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "super_admin");

    const adminIds = (admins ?? []).map((a: any) => a.id);
    recipientsCount = adminIds.length;

    if (adminIds.length === 0) {
      console.log("[emit-admin-event] no super admins found");
    }

    // 2) Load subscriptions for this event
    const { data: subs } = await supabase
      .from("admin_event_subscriptions")
      .select("*")
      .eq("event_key", event_key)
      .eq("enabled", true)
      .in("user_id", adminIds.length ? adminIds : ["00000000-0000-0000-0000-000000000000"]);

    // Default: if an admin has no explicit subscription for this event, treat as panel+push enabled
    const subByUser = new Map<string, any>();
    (subs ?? []).forEach((s: any) => subByUser.set(s.user_id, s));

    // 3) Panel notifications (fanout: one row per admin so per-user read state works)
    for (const adminId of adminIds) {
      const sub = subByUser.get(adminId);
      const wantPanel = sub ? sub.channel_panel : true;
      if (!wantPanel) continue;

      const { error: insErr } = await supabase.from("admin_notifications").insert({
        user_id: adminId,
        event_key,
        type: event_key,
        severity,
        priority: severity === "critical" ? "critical" : severity === "warning" ? "high" : "normal",
        title,
        message,
        description: message,
        tenant_id: tenant_id ?? null,
        action_url: action_url ?? null,
        payload,
      });
      if (!insErr) channelsDelivered.panel++;
    }

    // 4) Push notifications (reuse /api/public/send-push if configured)
    const pushUrl = Deno.env.get("APP_BASE_URL")
      ? `${Deno.env.get("APP_BASE_URL")}/api/public/send-push`
      : null;
    const pushSecret = Deno.env.get("PUSH_INTERNAL_SECRET");

    if (pushUrl && pushSecret) {
      for (const adminId of adminIds) {
        const sub = subByUser.get(adminId);
        const wantPush = sub ? sub.channel_push : true;
        if (!wantPush) continue;
        try {
          const res = await fetch(pushUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              secret: pushSecret,
              target: { user_id: adminId },
              payload: {
                title: `[Barbex Admin] ${title}`,
                body: message?.slice(0, 140) ?? "",
                url: action_url ?? "/admin/notifications",
                tag: `admin:${event_key}`,
              },
            }),
          });
          if (res.ok) channelsDelivered.push++;
        } catch (e) {
          console.warn("[emit-admin-event] push failed", adminId, (e as Error).message);
        }
      }
    }

    // 5) WhatsApp — best effort via whatsapp-cloud (only for explicit opt-ins with phone)
    for (const sub of subs ?? []) {
      if (!sub.channel_whatsapp || !sub.whatsapp_phone) continue;
      try {
        const { error: waErr } = await supabase.functions.invoke("whatsapp-cloud", {
          body: {
            recipient_phone: sub.whatsapp_phone,
            message: `🛡️ *Barbex Admin*\n\n*${title}*\n\n${message ?? ""}`,
            skip_tenant_check: true,
          },
        });
        if (!waErr) channelsDelivered.whatsapp++;
      } catch (e) {
        console.warn("[emit-admin-event] whatsapp failed", (e as Error).message);
      }
    }

    // 6) Log
    await supabase.from("admin_event_log").insert({
      event_key,
      severity,
      payload,
      tenant_id: tenant_id ?? null,
      recipients_count: recipientsCount,
      channels_delivered: channelsDelivered,
    });

    return new Response(
      JSON.stringify({ success: true, recipients: recipientsCount, channels: channelsDelivered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    errorMsg = e?.message ?? String(e);
    console.error("[emit-admin-event] error", errorMsg);
    try {
      await supabase.from("admin_event_log").insert({
        event_key: "unknown",
        severity: "critical",
        error: errorMsg,
        recipients_count: recipientsCount,
        channels_delivered: channelsDelivered,
      });
    } catch {}
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
