import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationTemplate } from "../_shared/template-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get time in BR timezone (UTC-3)
function getBRDate() {
  const now = new Date();
  const brOffset = -3 * 60;
  return new Date(now.getTime() + (now.getTimezoneOffset() + brOffset) * 60000);
}

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const executionLogs: any[] = [];
  const log = (msg: string, details?: any) => {
    const entry = { timestamp: new Date().toISOString(), message: msg, details };
    console.log(`[Automation] ${msg}`, details ? JSON.stringify(details) : "");
    executionLogs.push(entry);
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const targetTenantId = body.tenantId || body.barber_id;

    const brNow = getBRDate();
    const isScheduled = body.scheduled === true;

    // Update status to 'executing'
    await supabase.from("automation_status").update({
      status: 'executing',
      server_time: new Date().toISOString(),
      timezone: "America/Bahia"
    }).or("status.eq.active,status.eq.error,status.eq.offline");

    log(`Automation execution started (${isScheduled ? 'SCHEDULED' : 'MANUAL'})`, { 
      server_time_utc: new Date().toISOString(), 
      br_time: brNow.toISOString(),
      timezone: "America/Bahia (UTC-3)",
      target_tenant: targetTenantId || "ALL",
      source: isScheduled ? "pg_cron" : "manual_trigger"
    });

    let query = supabase
      .from("automations")
      .select("*")
      .eq("enabled", true);
    
    if (targetTenantId) {
      query = query.eq("tenant_id", targetTenantId);
    }

    const { data: automations, error: autoError } = await query;

    if (autoError) {
      log("Error fetching automations", autoError);
      throw autoError;
    }

    if (!automations || automations.length === 0) {
      log("No active automations found");
    } else {
      log(`Found ${automations.length} active automations`, automations.map(a => a.type));
    }

    const results = [];
    let totalMessagesSent = 0;
    let totalMessagesFailed = 0;
    let totalRecordsFound = 0;
    const errors: string[] = [];

    for (const automation of automations || []) {
      log(`Processing automation: ${automation.type}`, { 
        automation_id: automation.id, 
        barber_id: automation.barber_id
      });
      
      const { data: connection } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("barber_id", automation.barber_id)
        .eq("status", "connected")
        .maybeSingle();

      if (!connection) {
        log(`SKIP: No connected WhatsApp for barber ${automation.barber_id}`);
        continue;
      }

      let res;
      try {
        if (automation.type === "birthday") {
          res = await processBirthdayAutomation(supabase, automation, connection, log, brNow);
        } else if (automation.type === "appointment_confirmation") {
          res = await processAppointmentConfirmation(supabase, automation, connection, log, brNow);
        } else if (automation.type === "appointment_reminder") {
          res = await processAppointmentReminder(supabase, automation, connection, log, brNow);
        } else {
          log(`Automation type ${automation.type} not implemented yet.`);
          continue;
        }
        
        totalMessagesSent += res.sent || 0;
        totalMessagesFailed += res.failed || 0;
        totalRecordsFound += res.found || 0;
        if (res.error) errors.push(`${automation.type}: ${res.error}`);
        results.push(res);
      } catch (err) {
        log(`Error processing automation ${automation.type}`, err);
        totalMessagesFailed++;
        errors.push(`${automation.type}: ${err.message}`);
      }
    }

    log("Automation execution finished", { total_results: results });

    // Update status to 'active' with final counts
    const { data: statusRows } = await supabase.from("automation_status").select("id").limit(1);
    if (statusRows && statusRows.length > 0) {
      await supabase.from("automation_status").update({
        status: 'active',
        last_run_at: new Date().toISOString(),
        total_processed: totalRecordsFound,
        messages_sent: totalMessagesSent,
        messages_failed: totalMessagesFailed,
        last_error: errors.length > 0 ? errors.join("; ") : null
      }).eq("id", statusRows[0].id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results, 
      logs: executionLogs,
      summary: {
        total_automations: automations?.length || 0,
        records_found: totalRecordsFound,
        messages_sent: totalMessagesSent,
        messages_failed: totalMessagesFailed,
        errors
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    log("Fatal automation error", error);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    await supabase.from("automation_status").update({
      status: 'error',
      last_error: error.message,
      last_run_at: new Date().toISOString()
    }).neq("id", "00000000-0000-0000-0000-000000000000"); // Update all for safety

    return new Response(JSON.stringify({ error: error.message, logs: executionLogs, success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Return 200 so frontend can handle the {success: false} object
    });
  }
});

async function processBirthdayAutomation(supabase: any, automation: any, connection: any, log: Function, brNow: Date) {
  const day = String(brNow.getDate()).padStart(2, '0');
  const month = String(brNow.getMonth() + 1).padStart(2, '0');
  const birthdayStr = `${month}-${day}`;

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("barber_id", automation.barber_id);
  
  const bdayCustomers = customers?.filter((c: any) => {
    if (!c.birth_date) return false;
    return c.birth_date.endsWith(birthdayStr);
  });

  if (!bdayCustomers || bdayCustomers.length === 0) {
    log(`No birthdays found for today (${birthdayStr})`);
    return { type: "birthday", found: 0, sent: 0, failed: 0 };
  }

  log(`Found ${bdayCustomers.length} potential birthday customers`);

  let sentCount = 0;
  let failedCount = 0;
  for (const customer of bdayCustomers) {
    const todayStart = new Date(new Date(brNow).setHours(0,0,0,0)).toISOString();
    
    const { data: existing } = await supabase
      .from("automation_logs")
      .select("id")
      .eq("automation_id", automation.id)
      .eq("customer_id", customer.id)
      .eq("message_type", "birthday")
      .gte("created_at", todayStart)
      .maybeSingle();

    if (existing) {
      log(`SKIP: Birthday already sent today to ${customer.name}`);
      continue;
    }

    const variables = {
      cliente_nome: customer.name,
      barbearia_nome: connection.instance_name || "Nossa Barbearia",
    };

    const processedMessage = processAutomationTemplate(automation.template, variables);
    const result = await sendMessage(connection, customer.phone, processedMessage, log);
    
    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }

    await supabase.from("automation_logs").insert({
      automation_id: automation.id,
      tenant_id: automation.tenant_id,
      barber_id: automation.barber_id,
      customer_id: customer.id,
      status: result.success ? "success" : "error",
      message_type: "birthday",
      phone: normalizePhone(customer.phone),
      original_template: automation.template,
      processed_template: processedMessage,
      response: result.response,
      error_message: result.error
    });
  }

  return { type: "birthday", found: bdayCustomers.length, sent: sentCount, failed: failedCount };
}

async function processAppointmentConfirmation(supabase: any, automation: any, connection: any, log: Function, brNow: Date) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select("*, customers(*), profiles:barber_id(*), services:service_id(*)")
    .eq("barber_id", automation.barber_id)
    .eq("confirmation_sent", false)
    .gte("created_at", fifteenMinutesAgo);

  if (apptError) {
    return { type: "confirmation", error: apptError.message, found: 0, sent: 0, failed: 0 };
  }

  if (!appointments || appointments.length === 0) {
    return { type: "confirmation", found: 0, sent: 0, failed: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  for (const appt of appointments) {
    const variables = {
      cliente_nome: appt.customers?.name || appt.name,
      barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
      data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
      horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      profissional: appt.profiles?.responsible_name || "Seu Barbeiro",
      servico: appt.services?.name || "Serviço",
    };

    const processedMessage = processAutomationTemplate(automation.template, variables);
    const phone = appt.customers?.phone || appt.phone;

    if (!phone) {
      log(`SKIP: Appointment ${appt.id} has no phone`);
      continue;
    }

    const result = await sendMessage(connection, phone, processedMessage, log);
    
    if (result.success) {
      await supabase.from("appointments").update({ confirmation_sent: true }).eq("id", appt.id);
      sentCount++;
    } else {
      failedCount++;
    }

    await supabase.from("automation_logs").insert({
      automation_id: automation.id,
      tenant_id: automation.tenant_id,
      barber_id: automation.barber_id,
      customer_id: appt.customer_id,
      appointment_id: appt.id,
      status: result.success ? "success" : "error",
      message_type: "appointment_confirmation",
      phone: normalizePhone(phone),
      original_template: automation.template,
      processed_template: processedMessage,
      response: result.response,
      error_message: result.error
    });
  }

  return { type: "confirmation", found: appointments.length, sent: sentCount, failed: failedCount };
}

async function processAppointmentReminder(supabase: any, automation: any, connection: any, log: Function, brNow: Date) {
  const delayHours = automation.trigger_delay || 24;
  const targetTimeStart = new Date(Date.now() + (delayHours * 60 * 60 * 1000)).toISOString();
  const targetTimeEnd = new Date(Date.now() + (delayHours * 60 * 60 * 1000) + (15 * 60 * 1000)).toISOString();

  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select("*, customers(*), profiles:barber_id(*), services:service_id(*)")
    .eq("barber_id", automation.barber_id)
    .eq("status", "scheduled")
    .eq("reminder_sent", false)
    .gte("start_time", targetTimeStart)
    .lte("start_time", targetTimeEnd);

  if (apptError) {
    return { type: "reminder", error: apptError.message, found: 0, sent: 0, failed: 0 };
  }

  if (!appointments || appointments.length === 0) {
    return { type: "reminder", found: 0, sent: 0, failed: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  for (const appt of appointments) {
    const variables = {
      cliente_nome: appt.customers?.name || appt.name,
      barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
      data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
      horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      profissional: appt.profiles?.responsible_name || "Seu Barbeiro",
      servico: appt.services?.name || "Serviço",
    };

    const processedMessage = processAutomationTemplate(automation.template, variables);
    const phone = appt.customers?.phone || appt.phone;

    if (!phone) {
      log(`SKIP: Appointment ${appt.id} has no phone`);
      continue;
    }

    const result = await sendMessage(connection, phone, processedMessage, log);
    
    if (result.success) {
      await supabase.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);
      sentCount++;
    } else {
      failedCount++;
    }

    await supabase.from("automation_logs").insert({
      automation_id: automation.id,
      tenant_id: automation.tenant_id,
      barber_id: automation.barber_id,
      customer_id: appt.customer_id,
      appointment_id: appt.id,
      status: result.success ? "success" : "error",
      message_type: "appointment_reminder",
      phone: normalizePhone(phone),
      original_template: automation.template,
      processed_template: processedMessage,
      response: result.response,
      error_message: result.error
    });
  }

  return { type: "reminder", found: appointments.length, sent: sentCount, failed: failedCount };
}

async function sendMessage(connection: any, phone: string, message: string, log: Function) {
  try {
    const instanceId = connection.instance_id;
    const token = connection.instance_token;
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const baseUrl = connection.server_url || "https://api.z-api.io";
    
    if (!instanceId || !token) {
      throw new Error("Instance ID or Token missing");
    }

    const targetPhone = normalizePhone(phone);
    const headers: any = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;

    const response = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: targetPhone, message: message })
    });

    const data = await response.json();
    if (!response.ok) {
        log(`Z-API Error: ${response.status}`, data);
    }
    return { success: response.ok, response: data, error: !response.ok ? (data.message || data.error || `HTTP ${response.status}`) : null };
  } catch (error) {
    log(`Error in sendMessage: ${error.message}`);
    return { success: false, error: error.message };
  }
}