// Event-driven automation emitter — Phase 1 core
// Fetches active automation_templates for a (tenant, event) pair, resolves
// per-recipient phone, enqueues one automation_queue row per template.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";

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
    const hasModernCompletedReviewTemplate = event === "appointment.completed" &&
      (templates || []).some((tpl: any) => tpl.key === "appointment.completed.review.customer" && tpl.active === true);
    // NOTE: do NOT early-return when there are no templates — internal
    // notification recipients (recepção/gerente/dono) must still receive
    // panel + WhatsApp alerts even if no customer/barber/shop template exists.

    // 2. Load context: appointment / customer / barber / shop
    let appointment: any = null;
    if (appointment_id) {
      const { data, error: apptErr } = await supabase
        .from("appointments")
        .select("id, tenant_id, customer_id, barber_id, service_id, start_time, end_time, total_price, payment_method, management_token, customer:customers(id, name, phone), barber:barbers!appointments_barber_id_fkey(id, name, phone), service:services(id, name, price)")
        .eq("id", appointment_id)
        .maybeSingle();
      if (apptErr) console.error("[EmitEvent] appointment fetch error", apptErr);
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
      .select("id, business_name, whatsapp_number, whatsapp_enabled, slug, allow_notifications_on_business_phone")
      .eq("id", tenant_id)
      .maybeSingle();

    // Derived fields for message templates
    const fmtBRL = (v: any) => {
      const n = Number(v);
      if (!isFinite(n) || n <= 0) return "";
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };
    const fmtDate = (d: any) => {
      if (!d) return "";
      try {
        const [y, m, day] = String(d).split("T")[0].split("-");
        return `${day}/${m}/${y}`;
      } catch { return String(d); }
    };
    const fmtTime = (t: any) => (t ? String(t).slice(0, 5) : "");
    const apptDateStr = appointment?.start_time ? formatBrazilDate(appointment.start_time) : "";
    const apptTimeStr = appointment?.start_time ? formatBrazilTime(appointment.start_time) : "";
    // Nice labels for payment method
    const pmLabel = (raw: any): string => {
      const v = String(raw || "").toLowerCase();
      if (!v) return "";
      if (v === "pix") return "PIX";
      if (v === "cash" || v === "dinheiro") return "Dinheiro";
      if (v === "card" || v === "credit_card" || v === "debit_card") return "Cartão";
      if (v === "credit") return "Crédito";
      if (v === "cashback") return "Cashback";
      return String(raw);
    };
    const appointmentExtras: Record<string, any> = appointment ? {
      service_name: appointment.service?.name,
      service_price: fmtBRL(appointment.total_price ?? appointment.service?.price),
      appointment_date: apptDateStr,
      appointment_time: apptTimeStr,
      payment_method: pmLabel(appointment.payment_method),
      management_link: appointment.management_token
        ? `https://barbex.shop/agendamento/${appointment.management_token}`
        : undefined,
    } : {};

    // For reschedule events: if new_date/new_time weren't provided, use the
    // current appointment start as the "new" values so premium templates never
    // render empty placeholders. The caller (agendamento.$token / calendar
    // modal) should pass old_date/old_time in `extra`.
    if (event.startsWith("appointment.rescheduled")) {
      if (!extra?.new_date) appointmentExtras.new_date = apptDateStr;
      if (!extra?.new_time) appointmentExtras.new_time = apptTimeStr;
      console.log("[EmitEvent] RESCHEDULE EVENT CREATED", {
        event,
        actor: event.split(".").pop(),
        customer_phone: customer?.phone,
        professional_phone: barber?.phone,
        shop_phone: shopProfile?.whatsapp_number,
        management_link: appointmentExtras.management_link,
        old_date: extra?.old_date,
        old_time: extra?.old_time,
        new_date: appointmentExtras.new_date,
        new_time: appointmentExtras.new_time,
        template_count: templates?.length || 0,
      });
    }




    // For appointment.completed: ensure a review_token/link so the delayed
    // review template has something valid to send.
    if (event === "appointment.completed" && appointment?.id && customer?.id) {
      try {
        const { data: existing } = await supabase
          .from("appointment_reviews")
          .select("review_token")
          .eq("appointment_id", appointment.id)
          .maybeSingle();
        let token = existing?.review_token as string | undefined;
        if (!token) {
          token = crypto.randomUUID();
          const { error: upErr } = await supabase.from("appointment_reviews").upsert({
            tenant_id,
            appointment_id: appointment.id,
            customer_id: customer.id,
            barber_id: appointment.barber_id,
            review_token: token,
            token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            testimonial_status: "pending",
            show_on_frontend: false,
          }, { onConflict: "appointment_id" });
          if (upErr) console.warn("[EmitEvent] review token upsert failed", upErr);
        }
        if (token) {
          appointmentExtras.review_token = token;
          appointmentExtras.review_link = `https://barbex.shop/review/${token}`;
        }
      } catch (e) {
        console.warn("[EmitEvent] review link generation error", e);
      }
    }

    // For appointment.professional_changed, the caller sends a complete payload
    // built from oldAppointment + newAppointment snapshots immediately after
    // the update. Only fall back to lookup when legacy callers omit names.
    let previousBarber: any = null;
    let newBarber: any = null;
    if (event === "appointment.professional_changed") {
      const prevId = (extra as any)?.previous_professional_id || (extra as any)?.previous_barber_id || null;
      const newId = (extra as any)?.new_professional_id || (extra as any)?.new_barber_id || appointment?.barber_id || null;
      console.log("oldAppointment", (extra as any)?.oldAppointment || null);
      console.log("newAppointment", (extra as any)?.newAppointment || null);
      console.log("automationPayload", extra || {});
      previousBarber = {
        id: prevId,
        name: (extra as any)?.previous_professional_name || (extra as any)?.old_professional_name || "",
        phone: (extra as any)?.previous_professional_phone || "",
      };
      newBarber = {
        id: newId,
        name: (extra as any)?.new_professional_name || "",
        phone: (extra as any)?.new_professional_phone || "",
      };
      const ids = [prevId, newId].filter(Boolean) as string[];
      if (ids.length > 0 && (!previousBarber.phone || !newBarber.phone || !previousBarber.name || !newBarber.name)) {
        const { data: rows } = await supabase
          .from("barbers")
          .select("id, name, phone")
          .in("id", ids);
        const prevRow = rows?.find((r: any) => r.id === prevId) || null;
        const newRow = rows?.find((r: any) => r.id === newId) || null;
        previousBarber = { ...prevRow, ...previousBarber, phone: previousBarber.phone || prevRow?.phone || "", name: previousBarber.name || prevRow?.name || "" };
        newBarber = { ...newRow, ...newBarber, phone: newBarber.phone || newRow?.phone || "", name: newBarber.name || newRow?.name || "" };
      }
      appointmentExtras.previous_professional_id = prevId;
      appointmentExtras.new_professional_id = newId;
      appointmentExtras.old_professional_name = (extra as any)?.old_professional_name || (extra as any)?.previous_professional_name || previousBarber?.name || "";
      appointmentExtras.previous_professional_name = (extra as any)?.previous_professional_name || appointmentExtras.old_professional_name;
      appointmentExtras.new_professional_name = (extra as any)?.new_professional_name || newBarber?.name || barber?.name || "";
      appointmentExtras.actor_label = (extra as any)?.actor_label || "";
      if (!extra?.new_date) appointmentExtras.new_date = apptDateStr;
      if (!extra?.new_time) appointmentExtras.new_time = apptTimeStr;
      console.log("[EmitEvent] PROFESSIONAL_CHANGED", {
        prevId, newId,
        previous_name: appointmentExtras.previous_professional_name,
        new_name: appointmentExtras.new_professional_name,
        actor: appointmentExtras.actor_label,
      });
    }

    // 3. For each active template, enqueue one row with the right recipient phone
    const dispatched: string[] = [];
    const skipped: Array<{ template: string; reason: string }> = [];
    const eventTemplatePhones = new Set<string>();

    for (const tpl of templates || []) {
      if (event === "appointment.completed" && tpl.key === "post_service_review" && hasModernCompletedReviewTemplate) {
        skipped.push({ template: tpl.key, reason: "legacy_review_template_replaced" });
        continue;
      }

      const recipient = tpl.recipient || "customer";
      let phone: string | null = null;
      let recipientName: string | null = null;

      if (recipient === "customer") {
        if ((extra as any)?.silent_customer === true) {
          skipped.push({ template: tpl.key, reason: "silent_customer" });
          continue;
        }
        phone = customer?.phone || null;
        recipientName = customer?.name || null;
      } else if (recipient === "barber") {
        // STRICT: only the professional linked to this appointment.
        // Never broadcast to all barbers of the tenant.
        const profId = appointment?.barber_id || (appointment as any)?.professional_id || null;
        if (!profId) {
          console.warn(`[EmitEvent] barber recipient skipped: appointment has no professional_id (event=${event}, tpl=${tpl.key})`);
          skipped.push({ template: tpl.key, reason: "no_professional_id_on_appointment" });
          continue;
        }
        let resolvedBarber: any = barber && barber.id === profId ? barber : null;
        if (!resolvedBarber) {
          const { data: b } = await supabase
            .from("barbers")
            .select("id, name, phone")
            .eq("id", profId)
            .maybeSingle();
          resolvedBarber = b || null;
        }
        if (!resolvedBarber) {
          console.warn(`[EmitEvent] barber recipient skipped: professional ${profId} not found (event=${event}, tpl=${tpl.key})`);
          skipped.push({ template: tpl.key, reason: `professional_not_found:${profId}` });
          continue;
        }
        phone = resolvedBarber.phone || null;
        recipientName = resolvedBarber.name || null;
        if (!phone) {
          console.warn(`[EmitEvent] barber recipient skipped: professional ${profId} (${resolvedBarber.name}) has no phone (event=${event}, tpl=${tpl.key})`);
          skipped.push({ template: tpl.key, reason: `no_phone_for_professional:${profId}` });
          continue;
        }
      } else if (recipient === "shop") {
        phone = shopProfile?.whatsapp_number || null;
        recipientName = shopProfile?.business_name || null;
      } else if (recipient === "previous_barber") {
        if (!previousBarber) {
          skipped.push({ template: tpl.key, reason: "no_previous_barber_in_extra" });
          continue;
        }
        phone = previousBarber.phone || null;
        recipientName = previousBarber.name || null;
      } else if (recipient === "new_barber") {
        if (!newBarber) {
          skipped.push({ template: tpl.key, reason: "no_new_barber_in_extra" });
          continue;
        }
        phone = newBarber.phone || null;
        recipientName = newBarber.name || null;
      }

      if (!phone) {
        skipped.push({ template: tpl.key, reason: `no_phone_for_${recipient}` });
        continue;
      }

      // Delayed review template: only enqueue if we have a valid review_link
      const isReviewTpl = String(tpl.key || "").toLowerCase().includes("review");
      if (isReviewTpl) {
        if (!appointmentExtras.review_link) {
          console.warn(`[EmitEvent] review_link ausente — skip tpl=${tpl.key}`);
          skipped.push({ template: tpl.key, reason: "review_link_missing" });
          continue;
        }
      }
      const scheduledFor = isReviewTpl
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

      const idem = `${event}:${appointment_id || customer_id || "generic"}:${tpl.id}`;
      const normalizedTemplatePhone = normalizePhone(phone);
      if (normalizedTemplatePhone) eventTemplatePhones.add(normalizedTemplatePhone);

      const rawPayload = {
        recipient,
        recipient_phone: phone,
        recipient_name: recipientName,
        ...appointmentExtras,
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        professional_name: barber?.name,
        professional_phone: barber?.phone,
        barbershop_name: shopProfile?.business_name,
        tenant_id,
        appointment_id: appointment_id || null,
        ...(extra || {}),
      };

      const templateVariables = applyRecipientLinks(rawPayload, recipient);
      console.log("templateVariables", templateVariables);
      console.log("recipientList", [{ type: recipient, name: recipientName, phone: normalizePhone(phone) }]);

      const { error: insErr } = await supabase.from("automation_queue").insert({
        tenant_id,
        automation_id: tpl.id,
        appointment_id: appointment_id || null,
        customer_id: customer_id || customer?.id || null,
        workflow_key: tpl.key,
        event_name: event,
        status: "pending",
        scheduled_for: scheduledFor,
        idempotency_key: idem,
        payload: templateVariables,
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

      // Fire-and-forget browser push (non-blocking; failures don't affect WhatsApp queue)
      try {
        const normalizedPush = normalizePhone(phone);
        if (normalizedPush) {
          const pushBody = (tpl as any).push_body || (tpl as any).body_template || (tpl as any).message || tpl.key;
          const shortBody = String(pushBody).replace(/\{[^}]+\}/g, "").trim().slice(0, 140) || "Nova atualização Barbex";
          const pushPayload = {
            title: `${shopProfile?.business_name || "Barbex"}`,
            body: shortBody,
            url: recipient === "customer" ? `/${shopProfile?.slug || ""}/portal` : "/",
            tag: `${event}:${appointment_id || customer_id || tpl.id}`,
          };
          const origin = Deno.env.get("PUBLIC_APP_ORIGIN") || "https://barbex.shop";
          fetch(`${origin}/api/public/send-push`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              secret: Deno.env.get("VAPID_PRIVATE_KEY"),
              target: { customer_phone: normalizedPush, audience: recipient === "customer" ? "customer" : "staff" },
              payload: pushPayload,
            }),
          }).catch(() => {});
        }
      } catch (_e) { /* swallow */ }
    }

    // 3b. Internal notification recipients (dono, gerente, recepção, etc.)
    const eventFlagMap: Record<string, string> = {
      "appointment.created": "notify_new_appointment",
      "appointment.confirmed": "notify_new_appointment",
      "appointment.rescheduled.by_customer": "notify_rescheduled_appointment",
      "appointment.rescheduled.by_barber": "notify_rescheduled_appointment",
      "appointment.rescheduled.by_shop": "notify_rescheduled_appointment",
      "appointment.professional_changed": "notify_rescheduled_appointment",
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
      "review.excellent": "notify_review_received",
      "review.bad": "notify_bad_review",
      // NOTE: "review.pending_reply" removed — reminders now go ONLY to the
      // customer via the /api/public/hooks/review-reminders cron; the shop
      // must not receive "aguardando resposta" alerts.
      "support.ticket_created": "notify_support_ticket",
      "automation.failed": "notify_automation_failure",
    };
    const internalFlag = eventFlagMap[event];
    const internalRecipients: string[] = [];
    const recipientList: Array<{ type: string; name: string | null; phone: string | null }> = [];

    if (internalFlag) {
      let recipientsQuery = supabase
        .from("notification_recipients")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .eq(internalFlag, true);

      // For appointment events, filter recipients scoped to a specific
      // barber: keep recipients with no barber_id (general) OR that match
      // the appointment's barber. Non-appointment events ignore the scope.
      const isAppointmentEvent = event.startsWith("appointment.");
      const apptBarberId = appointment?.barber_id || appointment?.professional_id || null;
      if (isAppointmentEvent) {
        if (apptBarberId) {
          recipientsQuery = recipientsQuery.or(`barber_id.is.null,barber_id.eq.${apptBarberId}`);
        } else {
          recipientsQuery = recipientsQuery.is("barber_id", null);
        }
      }
      const { data: recipients } = await recipientsQuery;

      console.log(`[EmitEvent] Internal flag=${internalFlag} → recipients found: ${recipients?.length || 0} (apptBarber=${apptBarberId})`);

      const officialPhone = normalizePhone(shopProfile?.whatsapp_number);
      const allowOnOfficial = (shopProfile as any)?.allow_notifications_on_business_phone === true;

      const internalPayload = applyRecipientLinks({
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        barber_name: barber?.name,
        shop_name: shopProfile?.business_name,
        barbershop_name: shopProfile?.business_name,
        recipient_name: rcpName,
        ...appointmentExtras,
        ...(extra || {}),
      }, "internal");
      const buildFor = (rcpName?: string) => buildInternalMessage(event, { ...internalPayload, recipient_name: rcpName });
      const internalMessage = buildFor();


      const sentWaPhones = new Set<string>();
      const sentPanelUsers = new Set<string>();

      for (const rcp of recipients || []) {
        recipientList.push({ type: rcp.role || "internal", name: rcp.name || null, phone: normalizePhone(rcp.phone) || null });
        console.log(`[EmitEvent] Processing recipient ${rcp.name} (${rcp.phone}) wa=${rcp.receive_whatsapp} panel=${rcp.receive_panel}`);

        if (rcp.receive_whatsapp && rcp.phone) {
          const norm = normalizePhone(rcp.phone);
          if (!norm) continue;
          if (sentWaPhones.has(norm)) {
            console.log(`[EmitEvent] Skip duplicate WA phone ${norm} (${rcp.name})`);
            continue;
          }
          // Note: we intentionally do NOT skip when this phone also receives an
          // event template (e.g. barber template). Internal recipients (reception,
          // manager) are configured per-person and must always be notified, even
          // if their phone coincides with the barber's number.
          if (!allowOnOfficial && officialPhone && norm === officialPhone) {
            console.log(`[EmitEvent] Skip WA to business phone ${norm} (${rcp.name})`);
          } else {
            sentWaPhones.add(norm);
            const { data: waResp, error: waErr } = await supabase.functions.invoke("whatsapp-cloud", {
              body: {
                user_id: tenant_id,
                phone: norm,
                content: buildFor(rcp.name),
                metadata: { eventType: event, internal: true, recipient_id: rcp.id, templateVariables: { ...internalPayload, recipient_name: rcp.name } },
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
            metadata: { event, appointment_id, customer_id, recipient_id: rcp.id, ...internalPayload },
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
      console.log("recipientList", recipientList);
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

function applyRecipientLinks(payload: Record<string, any>, recipient: string): Record<string, any> {
  const next = { ...payload };
  if (payload.customer_management_link && recipient === "customer") {
    next.management_link = payload.customer_management_link;
  } else if (payload.new_professional_management_link && (recipient === "new_barber" || recipient === "barber")) {
    next.management_link = payload.new_professional_management_link;
  } else if (payload.internal_management_link && (recipient === "shop" || recipient === "internal")) {
    next.management_link = payload.internal_management_link;
  } else if (recipient === "previous_barber") {
    next.management_link = "";
  }
  return next;
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
    "review.excellent": "Avaliação 5 estrelas 🌟",
    "review.bad": "Avaliação negativa recebida",
    "review.pending_reply": "Avaliação aguardando resposta",
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
    const who = event.endsWith("by_customer") ? "Cliente" : event.endsWith("by_barber") ? "Barbeiro" : "Barbearia";
    const parts = [
      `🔄 ${header}`,
      ``,
      d.customer_name ? `👤 Cliente: ${d.customer_name}` : "",
      d.barber_name ? `💈 Profissional: ${d.barber_name}` : "",
      d.service_name ? `✂️ Serviço: ${d.service_name}` : "",
      `📅 De: ${d.old_date || "-"} ${d.old_time || ""}`.trim(),
      `➡ Para: ${d.new_date || "-"} ${d.new_time || ""}`.trim(),
      `Reagendado por: ${who}`,
      ``,
      d.management_link ? `🔗 Gerenciar agendamento:\n${d.management_link}` : "",
    ];
    return parts.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  if (event === "appointment.created" || event === "appointment.confirmed") {
    const parts = [
      `Olá${d.recipient_name ? ` ${d.recipient_name}` : ""}! 📣`,
      ``,
      `Novo agendamento realizado.`,
      ``,
      d.customer_name ? `👤 Cliente: ${d.customer_name}` : "",
      d.customer_phone ? `📞 Telefone: ${d.customer_phone}` : "",
      d.barber_name ? `💈 Profissional: ${d.barber_name}` : "",
      d.service_name ? `✂️ Serviço: ${d.service_name}` : "",
      (d.appointment_date || d.appointment_time) ? `📅 ${d.appointment_date || ""}${d.appointment_time ? ` às ${d.appointment_time}` : ""}` : "",
      d.payment_method ? `💳 Pagamento: ${d.payment_method}` : "",
      d.service_price ? `💰 Valor: ${d.service_price}` : "",
      ``,
      d.management_link ? `Gerenciar agendamento:\n${d.management_link}` : "",
      ``,
      `Mensagem automática do Barbex.`,
    ];
    return parts.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  if (event === "appointment.completed") {
    const parts = [
      `✅ Atendimento concluído`,
      ``,
      d.customer_name ? `👤 Cliente: ${d.customer_name}` : "",
      d.barber_name ? `💈 Profissional: ${d.barber_name}` : "",
      d.service_name ? `✂️ Serviço: ${d.service_name}` : "",
      d.service_price ? `💰 Valor: ${d.service_price}` : "",
      d.payment_method ? `💳 Pagamento: ${d.payment_method}` : "",
      ``,
      `Mensagem automática do Barbex.`,
    ];
    return parts.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  if (event.startsWith("review.")) {
    const stars = (n: any) => {
      const v = Number(n);
      if (!isFinite(v) || v <= 0) return "";
      return "⭐".repeat(Math.round(v));
    };
    const isPending = event === "review.pending_reply";
    const isBad = event === "review.bad";
    const isExcellent = event === "review.excellent";
    const icon = isPending ? "⏰" : isBad ? "⚠️" : isExcellent ? "🌟" : "⭐";
    const title = isPending
      ? "Avaliação aguardando sua resposta há mais de 24h"
      : isBad
      ? "Nova avaliação NEGATIVA — atenção"
      : isExcellent
      ? "Nova avaliação 5 estrelas!"
      : "Nova avaliação recebida";
    const parts = [
      `${icon} ${title}`,
      ``,
      d.customer_name ? `👤 Cliente: ${d.customer_name}` : "",
      d.service_name ? `✂️ Serviço: ${d.service_name}` : "",
      d.barber_name ? `💈 Profissional: ${d.barber_name}` : "",
      d.avg_rating ? `📊 Nota média: ${d.avg_rating} ${stars(d.avg_rating)}` : "",
      d.testimonial ? `💬 "${d.testimonial}"` : "",
      isPending && d.hours_pending ? `⏳ Aguardando resposta há ${d.hours_pending}h` : "",
      ``,
      isPending
        ? `Responda no painel Barbex › Avaliações para manter o engajamento.`
        : isBad
        ? `Entre em contato com o cliente o quanto antes para reverter a situação.`
        : `Acesse o painel Barbex › Avaliações para responder.`,
    ];
    return parts.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  if (event.startsWith("subscription.")) {
    return `💳 ${header}\n\n${line("Cliente", d.customer_name)}${line("Plano", d.plan_name || d.subscription_name)}${line("Valor", d.amount)}`.trim();
  }
  if (event === "payment.confirmed") {
    return `💰 ${header}\n\n${line("Cliente", d.customer_name)}${line("Valor", d.amount)}${line("Método", d.payment_method)}`.trim();
  }
  return `${header}\n\n${line("Cliente", d.customer_name)}`.trim();
}
