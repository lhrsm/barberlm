import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { formatBrazilDate, formatBrazilTime, normalizePhone, formatAppointmentDateTimeForMessage } from "../_shared/utils.ts";
import { sendMessage, getWhatsAppSettings } from "../_shared/whatsapp-settings.ts";
import { AUTOMATION_STATES } from "../_shared/automation-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { tenantId, workflowId, queueId } = await req.json().catch(() => ({}));
    
    console.log(`[AutomationEngine] Starting processing. Tenant: ${tenantId || 'ALL'}, Workflow: ${workflowId || 'ALL'}`);

    // 1. Fetch pending items from queue
    let query = supabase
      .from("automation_queue")
      .select(`
        *,
        automation_events (*),
        automation_workflows (*)
      `)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(20);

    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (workflowId) query = query.eq("workflow_id", workflowId);
    if (queueId) query = query.eq("id", queueId);

    const { data: queueItems, error: queueError } = await query;

    if (queueError) throw queueError;
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending items in queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AutomationEngine] Processing ${queueItems.length} items`);

    const results = [];

    for (const item of queueItems) {
      try {
        // Mark as processing
        await supabase.from("automation_queue").update({ 
          status: "processing", 
          attempts: (item.attempts || 0) + 1,
          updated_at: new Date().toISOString()
        }).eq("id", item.id);

        const workflow = item.automation_workflows;
        const event = item.automation_events;

        if (!workflow || !event) {
          throw new Error("Missing workflow or event data");
        }

        const result = await processWorkflowItem(supabase, item, workflow, event);
        
        // Mark as completed
        await supabase.from("automation_queue").update({ 
          status: "completed", 
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", item.id);

        results.push({ id: item.id, status: "completed", result });

      } catch (error: any) {
        console.error(`[AutomationEngine] Error processing item ${item.id}:`, error);
        await supabase.from("automation_queue").update({ 
          status: "failed", 
          error: error.message,
          updated_at: new Date().toISOString()
        }).eq("id", item.id);
        
        results.push({ id: item.id, status: "failed", error: error.message });
        
        await supabase.from("automation_logs").insert({
          tenant_id: item.tenant_id,
          workflow_id: item.workflow_id,
          queue_id: item.id,
          status: "error",
          message: `Erro ao processar item da fila: ${error.message}`,
          error_details: JSON.stringify({ error: error.message, stack: error.stack })
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[AutomationEngine] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function processWorkflowItem(supabase: any, item: any, workflow: any, event: any) {
  const eventName = event.event_name;
  const tenantId = item.tenant_id;
  const entityId = event.entity_id;
  const payload = event.payload || {};

  console.log(`[AutomationEngine] Processing event ${eventName} for entity ${entityId}`);

  if (eventName === 'appointment.created') {
    return await handleAppointmentCreated(supabase, tenantId, entityId, payload, workflow, item.id);
  }
  
  return { message: "Event not implemented" };
}

async function handleAppointmentCreated(supabase: any, tenantId: string, appointmentId: string, payload: any, workflow: any, queueId: string) {
  // 1. Fetch full appointment and customer data
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("*, customers(*), services(name), barbers(name), profiles:tenant_id(business_name)")
    .eq("id", appointmentId)
    .single();

  if (apptError || !appointment) throw new Error("Appointment not found");
  if (!appointment.customers?.phone) throw new Error("Customer phone not found");

  const customer = appointment.customers;
  const rawPhone = payload.force_phone || customer.phone;
  const normalizedPhoneValue = normalizePhone(rawPhone);

  // Use centralized formatting with America/Sao_Paulo timezone
  const { date: formattedDate, time: formattedTime } = formatAppointmentDateTimeForMessage(appointment);

  // 2. Anti-loop Check
  if (appointment.confirmation_sent === true || appointment.confirmation_sent_at) {
    console.log(`[AutomationEngine] BLOCKED: Initial message loop for appointment ${appointmentId}. Message already sent at ${appointment.confirmation_sent_at}`);
    
    await supabase.from("automation_logs").insert({
      tenant_id: tenantId,
      workflow_id: workflow.id,
      queue_id: queueId,
      event_name: 'blocked_initial_message_loop',
      status: "skipped",
      message: "Envio inicial bloqueado para evitar loop (já enviado)",
      error_details: JSON.stringify({
        appointment_id: appointmentId,
        confirmation_sent: appointment.confirmation_sent,
        confirmation_sent_at: appointment.confirmation_sent_at
      })
    });
    
    return { success: true, message: "Loop blocked" };
  }

  // 3. Generate Message
  const template = workflow.configuration?.template || "Olá {customer_name}, seu agendamento para {service_name} com {barber_name} em {appointment_date} às {appointment_time} foi recebido!";
  
  const message = template
    .replace('{customer_name}', customer.name || 'Cliente')
    .replace('{barbershop_name}', appointment.profiles?.business_name || 'Barbearia')
    .replace('{service_name}', appointment.services?.name || 'Serviço')
    .replace('{professional_name}', appointment.barbers?.name || 'Profissional')
    .replace('{barber_name}', appointment.barbers?.name || 'Profissional')
    .replace('{appointment_date}', formattedDate)
    .replace('{appointment_time}', formattedTime)
    .replace('{service_price}', appointment.total_price?.toString() || '0')
    .replace('{customer_phone}', rawPhone)
    .replace('{payment_method}', appointment.payment_method || 'Não definido')
    .replace('{appointment_status}', appointment.status || 'Pendente');

  // 4. Deactivate previous active conversations for this customer to avoid overlapping sessions
  await supabase.from("conversation_sessions")
    .update({ status: 'closed', active: false })
    .eq("tenant_id", tenantId)
    .eq("phone", normalizedPhoneValue)
    .eq("status", "active");

  // 5. Create Session (conversation_sessions)

  const { data: session, error: sessionError } = await supabase
    .from("conversation_sessions")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      phone: normalizedPhoneValue,
      channel: 'whatsapp',
      status: 'active',
      current_step: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
      appointment_id: appointmentId,
      context: { 
        appointment_id: appointmentId,
        customer_name: customer.name,
        raw_appointment_datetime: appointment.start_time,
        formatted_brazil_datetime: `${formattedDate} ${formattedTime}`
      }
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 5. Send Message via Z-API
  const connection = await getWhatsAppSettings(supabase, tenantId);
  if (!connection) throw new Error("WhatsApp settings not found for tenant");

  const buttons = [
    { id: "main_confirm", label: "Confirmar agendamento" },
    { id: "main_reschedule", label: "Reagendar" },
    { id: "main_cancel", label: "Cancelar" }
  ];

  const result = await sendMessage(connection, normalizedPhoneValue, message, { buttons });

  // 6. Update session and appointments after send
  if (result.success && result.response?.messageId) {
    await supabase
      .from("conversation_sessions")
      .update({ 
        provider_message_id: result.response.messageId,
        last_message_id: result.response.messageId
      })
      .eq("id", session.id);
      
    // Mark appointment
    await supabase.from("appointments")
      .update({ 
        confirmation_sent: true, 
        confirmation_sent_at: new Date().toISOString() 
      })
      .eq("id", appointmentId);
  }

  // 7. Log result
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    workflow_id: workflow.id,
    queue_id: queueId,
    session_id: session.id,
    event_name: 'appointment.created',
    status: result.success ? "success" : "error",
    message: result.success ? "Mensagem inicial enviada" : `Erro ao enviar: ${result.error}`,
    error_details: JSON.stringify({
      result,
      raw_appointment_datetime: appointment.start_time,
      formatted_brazil_datetime: `${formattedDate} ${formattedTime}`,
      message_time_sent: new Date().toISOString()
    })
  });

  return result;
}
