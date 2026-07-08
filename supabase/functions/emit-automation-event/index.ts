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

    // 3b. Internal notification recipients (dono, gerente, recepção, etc.)
    const eventFlagMap: Record<string, string> = {
      "appointment.created": "notify_new_appointment",
      "appointment.confirmed": "notify_new_appointment",
      "appointment.rescheduled.by_customer": "notify_rescheduled_appointment",
      "appointment.rescheduled.by_barber": "notify_rescheduled_appointment",
      "appointment.rescheduled.by_shop": "notify_rescheduled_appointment",
      "appointment.cancelled.by_customer": "notify_cancelled_appointment",
      "appointment.cancelled.by_barber": "notify_cancelled_appointment",
      "appointment.cancelled.by_shop": "notify_cancelled_appointment",
      "appointment.completed": "notify_completed_appointment",
      "subscription.created": "notify_new_subscription",
      "subscription.cancelled": "notify_subscription_cancelled",
      "subscription.renewed": "notify_payment_received",
      "subscription.renewal_failed": "notify_payment_failed",
      "payment.confirmed": "notify_payment_received",
      "review.received": "notify_review_received",
      "review.bad": "notify_bad_review",
      "support.ticket_created": "notify_support_ticket",
      "automation.failed": "notify_automation_failure",
    };
    const internalFlag = eventFlagMap[event];
    const internalRecipients: string[] = [];

    if (internalFlag) {
      const { data: recipients } = await supabase
        .from("notification_recipients")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .eq(internalFlag, true);

      const officialPhone = normalizePhone(shopProfile?.whatsapp_number);
      const allowOnOfficial = (shopProfile as any)?.allow_notifications_on_business_phone === true;

      const internalMessage = buildInternalMessage(event, {
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        barber_name: barber?.name,
        shop_name: shopProfile?.business_name,
        ...(extra || {}),
      });

      for (const rcp of recipients || []) {
        if (rcp.receive_whatsapp && rcp.phone) {
          const norm = normalizePhone(rcp.phone);
          if (allowOnOfficial || !officialPhone || norm !== officialPhone) {
            supabase.functions
              .invoke("whatsapp-cloud", {
                body: {
                  user_id: tenant_id,
                  phone: rcp.phone,
                  content: internalMessage,
                  metadata: { eventType: event, internal: true, recipient_id: rcp.id },
                },
              })
              .catch((e) => console.error("[EmitEvent] Internal WA failed", e));
            internalRecipients.push(`wa:${rcp.name}`);
          }
        }

        if (rcp.receive_panel) {
          await supabase.from("notifications").insert({
            user_id: tenant_id,
            tenant_id,
            type: event,
            title: internalTitle(event),
            message: internalMessage,
            data: { event, appointment_id, customer_id, recipient_id: rcp.id, ...(extra || {}) },
            read: false,
          }).then(() => internalRecipients.push(`panel:${rcp.name}`))
            .catch((e: any) => console.error("[EmitEvent] Panel insert failed", e));
        }

        if (rcp.receive_email && rcp.email) {
          console.log("[EmitEvent] Would email", rcp.email, event);
          internalRecipients.push(`email:${rcp.name}`);
        }
      }
    }

    // 4. Kick the processor (fire and forget)
    if (dispatched.length > 0) {
      supabase.functions
        .invoke("process-automation-queue", { body: { tenant_id, appointment_id } })
        .catch((e) => console.error("[EmitEvent] Kick failed", e));
    }

    return json({ success: true, dispatched, skipped, internal: internalRecipients });
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
