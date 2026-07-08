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
    console.log(`[EmitEvent] Templates found for ${event}: ${templates?.length || 0}`);
    // NOTE: do NOT early-return when there are no templates — internal
    // notification recipients (recepção/gerente/dono) must still receive
    // panel + WhatsApp alerts even if no customer/barber/shop template exists.

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

    for (const tpl of templates || []) {
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

      console.log(`[EmitEvent] Internal flag=${internalFlag} → recipients found: ${recipients?.length || 0}`);

      const officialPhone = normalizePhone(shopProfile?.whatsapp_number);
      const allowOnOfficial = (shopProfile as any)?.allow_notifications_on_business_phone === true;

      const internalMessage = buildInternalMessage(event, {
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        barber_name: barber?.name,
        shop_name: shopProfile?.business_name,
        ...(extra || {}),
      });

      const sentWaPhones = new Set<string>();
      const sentPanelUsers = new Set<string>();

      for (const rcp of recipients || []) {
        console.log(`[EmitEvent] Processing recipient ${rcp.name} (${rcp.phone}) wa=${rcp.receive_whatsapp} panel=${rcp.receive_panel}`);

        if (rcp.receive_whatsapp && rcp.phone) {
          const norm = normalizePhone(rcp.phone);
          if (!norm) continue;
          if (sentWaPhones.has(norm)) {
            console.log(`[EmitEvent] Skip duplicate WA phone ${norm} (${rcp.name})`);
            continue;
          }
          if (!allowOnOfficial && officialPhone && norm === officialPhone) {
            console.log(`[EmitEvent] Skip WA to business phone ${norm} (${rcp.name})`);
          } else {
            sentWaPhones.add(norm);
            const { data: waResp, error: waErr } = await supabase.functions.invoke("whatsapp-cloud", {
              body: {
                user_id: tenant_id,
                phone: norm,
                content: internalMessage,
                metadata: { eventType: event, internal: true, recipient_id: rcp.id },
              },
            });
            if (waErr) {
              console.error(`[EmitEvent] Internal WA failed for ${rcp.name} (${norm})`, waErr);
            } else {
              console.log(`[EmitEvent] Internal WA sent to ${rcp.name} (${norm})`, waResp);
              internalRecipients.push(`wa:${rcp.name}`);
            }
          }
        }

        if (rcp.receive_panel) {
          const panelKey = `${tenant_id}:${rcp.id}`;
          if (sentPanelUsers.has(panelKey)) continue;
          sentPanelUsers.add(panelKey);
          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: tenant_id,
            tenant_id,
            type: event,
            title: internalTitle(event),
            message: internalMessage,
            metadata: { event, appointment_id, customer_id, recipient_id: rcp.id, ...(extra || {}) },
            read: false,
          });
          if (notifErr) console.error("[EmitEvent] Panel insert failed", notifErr);
          else internalRecipients.push(`panel:${rcp.name}`);
        }

        if (rcp.receive_email && rcp.email) {
          console.log("[EmitEvent] Would email", rcp.email, event);
          internalRecipients.push(`email:${rcp.name}`);
        }
      }
    } else {
      console.log(`[EmitEvent] No internal flag mapping for event ${event}`);
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

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  return digits.startsWith("55") ? digits : digits.length >= 10 ? `55${digits}` : digits;
}

function internalTitle(event: string): string {
  const map: Record<string, string> = {
    "appointment.created": "Novo agendamento",
    "appointment.confirmed": "Agendamento confirmado",
    "appointment.completed": "Atendimento concluído",
    "appointment.cancelled.by_customer": "Agendamento cancelado pelo cliente",
    "appointment.cancelled.by_barber": "Agendamento cancelado pelo barbeiro",
    "appointment.cancelled.by_shop": "Agendamento cancelado pela barbearia",
    "appointment.rescheduled.by_customer": "Reagendamento pelo cliente",
    "appointment.rescheduled.by_barber": "Reagendamento pelo barbeiro",
    "appointment.rescheduled.by_shop": "Reagendamento pela barbearia",
    "subscription.created": "Novo assinante",
    "subscription.cancelled": "Assinatura cancelada",
    "subscription.renewed": "Assinatura renovada",
    "subscription.renewal_failed": "Falha na renovação",
    "payment.confirmed": "Pagamento confirmado",
    "review.received": "Nova avaliação",
    "review.bad": "Avaliação negativa recebida",
    "support.ticket_created": "Novo chamado de suporte",
    "automation.failed": "Falha em automação",
  };
  return map[event] || "Notificação Barbex";
}

function buildInternalMessage(event: string, d: Record<string, any>): string {
  const line = (label: string, value: any) => (value ? `${label}: ${value}\n` : "");
  const header = internalTitle(event);
  if (event.startsWith("appointment.cancelled")) {
    const who = event.endsWith("by_customer") ? "Cliente" : event.endsWith("by_barber") ? "Barbeiro" : "Barbearia";
    return `❌ ${header}\n\n${line("Cliente", d.customer_name)}${line("Serviço", d.service_name)}${line("Profissional", d.barber_name)}${line("Data", d.appointment_date || d.new_date)}${line("Horário", d.appointment_time || d.new_time)}Cancelado por: ${who}\n${line("Motivo", d.cancel_reason)}`.trim();
  }
  if (event.startsWith("appointment.rescheduled")) {
    return `🔄 ${header}\n\n${line("Cliente", d.customer_name)}${line("Serviço", d.service_name)}${line("Profissional", d.barber_name)}\nAnterior: ${d.old_date || "-"} ${d.old_time || ""}\nNova: ${d.new_date || "-"} ${d.new_time || ""}`.trim();
  }
  if (event === "appointment.created" || event === "appointment.confirmed") {
    return `📅 ${header}\n\n${line("Cliente", d.customer_name)}${line("Telefone", d.customer_phone)}${line("Serviço", d.service_name)}${line("Profissional", d.barber_name)}${line("Data", d.appointment_date)}${line("Horário", d.appointment_time)}${line("Valor", d.service_price)}${line("Pagamento", d.payment_method)}`.trim();
  }
  if (event === "appointment.completed") {
    return `✅ ${header}\n\n${line("Cliente", d.customer_name)}${line("Serviço", d.service_name)}${line("Profissional", d.barber_name)}`.trim();
  }
  if (event.startsWith("subscription.")) {
    return `💳 ${header}\n\n${line("Cliente", d.customer_name)}${line("Plano", d.plan_name || d.subscription_name)}${line("Valor", d.amount)}`.trim();
  }
  if (event === "payment.confirmed") {
    return `💰 ${header}\n\n${line("Cliente", d.customer_name)}${line("Valor", d.amount)}${line("Método", d.payment_method)}`.trim();
  }
  return `${header}\n\n${line("Cliente", d.customer_name)}`.trim();
}
