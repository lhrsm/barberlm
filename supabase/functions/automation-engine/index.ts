import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
        await supabase.from("automation_queue").update({ status: "processing", attempts: (item.attempts || 0) + 1 }).eq("id", item.id);

        const workflow = item.automation_workflows;
        const event = item.automation_events;

        if (!workflow || !event) {
          throw new Error("Missing workflow or event data");
        }

        // Process based on workflow type/configuration
        // For now, let's implement the core logic for the requested automations
        const result = await processWorkflowItem(supabase, item, workflow, event);
        
        // Mark as completed
        await supabase.from("automation_queue").update({ 
          status: "completed", 
          processed_at: new Date().toISOString() 
        }).eq("id", item.id);

        results.push({ id: item.id, status: "completed", result });

      } catch (error) {
        console.error(`[AutomationEngine] Error processing item ${item.id}:`, error);
        await supabase.from("automation_queue").update({ 
          status: "failed", 
          error: error.message 
        }).eq("id", item.id);
        
        results.push({ id: item.id, status: "failed", error: error.message });
        
        // Log the error
        await supabase.from("automation_logs").insert({
          tenant_id: item.tenant_id,
          workflow_id: item.workflow_id,
          queue_id: item.id,
          status: "error",
          message: `Erro ao processar item da fila: ${error.message}`,
          error_details: JSON.stringify(error)
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[AutomationEngine] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function processWorkflowItem(supabase: any, item: any, workflow: any, event: any) {
  const config = workflow.configuration || {};
  const eventName = event.event_name;
  const tenantId = item.tenant_id;

  console.log(`[AutomationEngine] Processing workflow ${workflow.name} for event ${eventName}`);

  // 1. Resolve Data
  const entityType = event.entity_type;
  const entityId = event.entity_id;
  const payload = event.payload || {};

  // 2. Determine Action
  // This is a simplified engine that handles the main requested automations
  if (eventName === 'appointment.created') {
    return await handleAppointmentCreated(supabase, tenantId, entityId, payload, workflow, item.id);
  }
  
  // TODO: Implement other event handlers
  
  return { message: "Event ignored or not implemented yet" };
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
  const phone = payload.force_phone || customer.phone;

  // 2. Generate Message (simplified for now, using workflow config or default)
  const template = workflow.configuration?.template || "Olá {customer_name}, seu agendamento para {service_name} com {barber_name} em {appointment_date} às {appointment_time} foi recebido!";
  
  const formattedDate = new Date(appointment.start_time).toLocaleDateString('pt-BR');
  const formattedTime = new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const message = template
    .replace('{customer_name}', customer.name || 'Cliente')
    .replace('{barbershop_name}', appointment.profiles?.business_name || 'Barbearia')
    .replace('{service_name}', appointment.services?.name || 'Serviço')
    .replace('{professional_name}', appointment.barbers?.name || 'Profissional')
    .replace('{barber_name}', appointment.barbers?.name || 'Profissional')
    .replace('{appointment_date}', formattedDate)
    .replace('{appointment_time}', formattedTime)
    .replace('{service_price}', appointment.total_price?.toString() || '0')
    .replace('{customer_phone}', phone)
    .replace('{payment_method}', appointment.payment_method || 'Não definido')
    .replace('{appointment_status}', appointment.status || 'Pendente');


  // 3. Create Session
  const { data: session, error: sessionError } = await supabase
    .from("conversation_sessions")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      phone: phone,
      channel: 'whatsapp',
      status: 'active',
      current_step: 'awaiting_main_action',
      appointment_id: appointmentId,
      context: { 
        appointment_id: appointmentId,
        customer_name: customer.name
      }
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 4. Send Message via Provider
  const result = await sendMessageViaProvider(supabase, tenantId, phone, message, {
    buttons: [
      { id: "main_confirm", label: "Confirmar agendamento" },
      { id: "main_reschedule", label: "Reagendar" },
      { id: "main_cancel", label: "Cancelar" }
    ]
  });

  // 5. Update session with provider message ID
  if (result.success && result.response?.messageId) {
    await supabase
      .from("conversation_sessions")
      .update({ 
        provider_message_id: result.response.messageId,
        last_message_id: result.response.messageId
      })
      .eq("id", session.id);
  }

  // 5. Log
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    workflow_id: workflow.id,
    queue_id: queueId,
    session_id: session.id,
    event_name: 'appointment.created',
    step: 'initial_message',
    status: result.success ? "success" : "error",
    message: result.success ? "Mensagem inicial enviada" : `Erro ao enviar: ${result.error}`,
    error_details: result.success ? null : JSON.stringify(result.response)
  });

  return result;
}

async function sendMessageViaProvider(supabase: any, tenantId: string, phone: string, message: string, options: any) {
  // 1. Get Provider
  const { data: provider, error: providerError } = await supabase
    .from("messaging_providers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();

  // Fallback to old whatsapp_instances if no new provider configured
  if (providerError || !provider) {
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .maybeSingle();

    if (!instance) return { success: false, error: "No active messaging provider found" };
    
    // Call legacy send logic (importing would be hard here, so we copy the core fetch)
    return await sendZApi(instance, phone, message, options);
  }

  if (provider.provider === 'zapi') {
    return await sendZApi(provider, phone, message, options);
  }
  
  // TODO: Implement other providers
  return { success: false, error: `Provider ${provider.provider} not implemented yet` };
}

async function sendZApi(connection: any, phone: string, message: string, options: any) {
  const instanceId = connection.instance_id;
  const token = connection.token;
  const clientToken = connection.client_token;
  const baseUrl = connection.server_url || "https://api.z-api.io";
  
  let targetPhone = phone.replace(/\D/g, "");
  if (targetPhone.length === 10 || targetPhone.length === 11) {
    targetPhone = "55" + targetPhone;
  }

  const headers: any = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  let sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
  let body: any = { phone: targetPhone, message };

  if (options.buttons) {
    sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-button-list`;
    body = {
      phone: targetPhone,
      message: message,
      buttonList: {
        buttons: options.buttons.map((b: any) => ({
          id: b.id,
          label: b.label
        }))
      }
    };
  }

  try {
    const response = await fetch(sendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return { success: response.ok, response: data, error: !response.ok ? (data.message || data.error) : null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
