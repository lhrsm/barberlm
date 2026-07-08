// Event-driven automation emitter — Phase 1 core
// Fetches active automation_templates for a (tenant, event) pair, resolves
// per-recipient phone, enqueues one automation_queue row per template.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmitPayload {
  tenant_id: string;
  event: string; // e.g. "appointment.confirmed"
  appointment_id?: string;
  customer_id?: string;
  extra?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = (await req.json()) as EmitPayload;
    const { tenant_id, event, appointment_id, customer_id, extra } = body;

    if (!tenant_id || !event) {
      return json({ success: false, error: "tenant_id and event are required" }, 400);
    }

    console.log("[EmitEvent] Start", { tenant_id, event, appointment_id, customer_id });

    // 1. Load active templates for this event
    const { data: templates, error: tplErr } = await supabase
      .from("automation_templates")
      .select("id, key, recipient, active")
      .eq("tenant_id", tenant_id)
      .eq("trigger_event", event)
      .eq("active", true);

    if (tplErr) throw tplErr;
    if (!templates || templates.length === 0) {
      console.log("[EmitEvent] No active templates for event", event);
      return json({ success: true, dispatched: 0, reason: "no_active_templates" });
    }

    // 2. Load context: appointment / customer / barber / shop
    let appointment: any = null;
    if (appointment_id) {
      const { data } = await supabase
        .from("appointments")
        .select("id, tenant_id, customer_id, barber_id, customer:customers(id, name, phone), barber:barbers(id, name, phone)")
        .eq("id", appointment_id)
        .maybeSingle();
      appointment = data;
    }

    let customer: any = appointment?.customer || null;
    if (!customer && customer_id) {
      const { data } = await supabase.from("customers").select("id, name, phone").eq("id", customer_id).maybeSingle();
      customer = data;
    }

    const barber = appointment?.barber || null;

    const { data: shopProfile } = await supabase
      .from("profiles")
      .select("id, business_name, whatsapp_number, whatsapp_enabled")
      .eq("id", tenant_id)
      .maybeSingle();

    // 3. For each active template, enqueue one row with the right recipient phone
    const dispatched: string[] = [];
    const skipped: Array<{ template: string; reason: string }> = [];

    for (const tpl of templates) {
      const recipient = tpl.recipient || "customer";
      let phone: string | null = null;
      let recipientName: string | null = null;

      if (recipient === "customer") {
        phone = customer?.phone || null;
        recipientName = customer?.name || null;
      } else if (recipient === "barber") {
        phone = barber?.phone || null;
        recipientName = barber?.name || null;
      } else if (recipient === "shop") {
        phone = shopProfile?.whatsapp_number || null;
        recipientName = shopProfile?.business_name || null;
      }

      if (!phone) {
        skipped.push({ template: tpl.key, reason: `no_phone_for_${recipient}` });
        continue;
      }

      const idem = `${event}:${appointment_id || customer_id || "generic"}:${tpl.id}`;

      const { error: insErr } = await supabase.from("automation_queue").insert({
        tenant_id,
        automation_id: tpl.id,
        appointment_id: appointment_id || null,
        customer_id: customer_id || customer?.id || null,
        workflow_key: tpl.key,
        event_name: event,
        status: "pending",
        idempotency_key: idem,
        payload: {
          recipient,
          recipient_phone: phone,
          recipient_name: recipientName,
          ...(extra || {}),
        },
      });

      if (insErr) {
        // duplicate idem => idempotent no-op
        if ((insErr as any).code === "23505") {
          skipped.push({ template: tpl.key, reason: "duplicate" });
          continue;
        }
        console.error("[EmitEvent] Insert failed", insErr);
        skipped.push({ template: tpl.key, reason: insErr.message });
        continue;
      }
      dispatched.push(tpl.key);
    }

    // 4. Kick the processor (fire and forget)
    if (dispatched.length > 0) {
      supabase.functions
        .invoke("process-automation-queue", { body: { tenant_id, appointment_id } })
        .catch((e) => console.error("[EmitEvent] Kick failed", e));
    }

    return json({ success: true, dispatched, skipped });
  } catch (e: any) {
    console.error("[EmitEvent] Fatal", e);
    return json({ success: false, error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
