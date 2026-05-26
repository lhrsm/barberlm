import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationTemplate } from "../_shared/template-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBRTimeInfo() {
  const now = new Date();
  // Using America/Bahia (UTC-3, no DST)
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const info: any = {};
  parts.forEach(p => info[p.type] = p.value);
  return {
    day: info.day,
    month: info.month,
    year: info.year,
    hour: info.hour,
    minute: info.minute,
    iso: `${info.year}-${info.month}-${info.day}T${info.hour}:${info.minute}:${info.second}`
  };
}

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const appointmentsFound: any[] = [];
  const birthdaysFound: any[] = [];
  const messagesSent: any[] = [];
  const errors: string[] = [];
  const ignoredRecords: any[] = [];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const brTime = getBRTimeInfo();
  const serverTime = new Date().toISOString();
  
  console.log(`[Automation] Started. Server: ${serverTime}, BR: ${brTime.iso}`);

  try {
    const body = await req.json().catch(() => ({}));
    const targetTenantId = body.tenantId;

    await supabase.from("automation_status").update({
      status: 'executing',
      server_time: serverTime,
      timezone: "America/Bahia"
    }).or("status.eq.active,status.eq.error,status.eq.offline");

    let query = supabase.from("automations").select("*").eq("enabled", true);
    if (targetTenantId) {
      query = query.eq("tenant_id", targetTenantId);
    }
    const { data: automations, error: autoError } = await query;

    if (autoError) throw autoError;

    for (const automation of automations || []) {
      const { data: connection } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("barber_id", automation.barber_id)
        .eq("status", "connected")
        .maybeSingle();

      if (!connection) {
        ignoredRecords.push({ automation_id: automation.id, reason: "WhatsApp não conectado para este barbeiro" });
        continue;
      }

      let res: any = { found: 0, sent: 0, failed: 0 };
      
      if (automation.type === "birthday") {
        res = await processBirthdayAutomation(supabase, automation, connection, brTime);
      } else if (automation.type === "appointment_confirmation") {
        res = await processAppointmentConfirmation(supabase, automation, connection);
      } else if (automation.type === "appointment_reminder") {
        res = await processAppointmentReminder(supabase, automation, connection);
      }

      if (res.appointments) appointmentsFound.push(...res.appointments);
      if (res.birthdays) birthdaysFound.push(...res.birthdays);
      if (res.sentItems) messagesSent.push(...res.sentItems);
      if (res.errors) errors.push(...res.errors);
      if (res.ignored) ignoredRecords.push(...res.ignored);
    }

    const executionTime = `${Date.now() - startTime}ms`;
    
    const { data: statusRows } = await supabase.from("automation_status").select("id").limit(1);
    if (statusRows && statusRows.length > 0) {
      await supabase.from("automation_status").update({
        status: 'active',
        last_run_at: serverTime,
        total_processed: appointmentsFound.length + birthdaysFound.length,
        messages_sent: messagesSent.filter(m => m.status === 'success').length,
        messages_failed: messagesSent.filter(m => m.status === 'error').length,
        last_error: errors.length > 0 ? errors.slice(0, 3).join("; ") : null
      }).eq("id", statusRows[0].id);
    }

    const responseData = {
      success: true,
      serverTime,
      brTime: brTime.iso,
      timezone: "America/Bahia",
      appointmentsFound,
      birthdaysFound,
      messagesSent,
      ignoredRecords,
      errors,
      executionTime,
      summary: {
        total_automations: automations?.length || 0,
        records_found: appointmentsFound.length + birthdaysFound.length,
        messages_sent: messagesSent.filter(m => m.status === 'success').length,
        messages_failed: messagesSent.filter(m => m.status === 'error').length,
        errors
      }
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[Automation] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message, serverTime, timezone: "America/Bahia" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

async function processBirthdayAutomation(supabase: any, automation: any, connection: any, brTime: any) {
  const birthdayPattern = `%-${brTime.month}-${brTime.day}`;

  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("barber_id", automation.barber_id)
    .not("birth_date", "is", null);

  if (error) return { birthdays: [], errors: [error.message] };
  
  // Filter in JS to be safe with date types and formats
  const bdayCustomers = customers?.filter((c: any) => {
    if (!c.birth_date) return false;
    // Handle both YYYY-MM-DD and potentially other formats if database varies
    return c.birth_date.includes(`-${brTime.month}-${brTime.day}`);
  });

  if (!bdayCustomers || bdayCustomers.length === 0) return { birthdays: [] };

  const birthdays = bdayCustomers.map(c => ({ id: c.id, name: c.name, type: 'birthday' }));
  const sentItems = [];
  const ignored = [];

  for (const customer of bdayCustomers) {
    const todayISO = `${brTime.year}-${brTime.month}-${brTime.day}`;
    
    const { data: existing } = await supabase
      .from("automation_logs")
      .select("id")
      .eq("automation_id", automation.id)
      .eq("customer_id", customer.id)
      .eq("message_type", "birthday")
      .filter('created_at', 'gte', `${todayISO}T00:00:00`)
      .maybeSingle();

    if (existing) {
      ignored.push({ customer_id: customer.id, reason: "Mensagem de aniversário já enviada hoje" });
      continue;
    }

    const variables = {
      cliente_nome: customer.name,
      barbearia_nome: connection.instance_name || "Nossa Barbearia",
    };

    const processedMessage = processAutomationTemplate(automation.template, variables);
    const result = await sendMessage(connection, customer.phone, processedMessage);
    
    const logEntry = {
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
      error_message: result.error,
      sent_at: new Date().toISOString()
    };

    await supabase.from("automation_logs").insert(logEntry);
    sentItems.push({ ...logEntry, customer_name: customer.name });
  }

  return { birthdays, sentItems, ignored };
}

async function processAppointmentConfirmation(supabase: any, automation: any, connection: any) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*, customers(*), profiles:barber_id(*), services:service_id(*)")
    .eq("barber_id", automation.barber_id)
    .eq("confirmation_sent", false)
    .gte("created_at", fifteenMinutesAgo);

  if (error) return { appointments: [], errors: [error.message] };
  if (!appointments || appointments.length === 0) return { appointments: [] };

  const sentItems = [];
  const ignored = [];

  for (const appt of appointments) {
    const phone = appt.customers?.phone || appt.phone;
    if (!phone) {
      ignored.push({ appointment_id: appt.id, reason: "Cliente sem telefone cadastrado" });
      continue;
    }

    const variables = {
      cliente_nome: appt.customers?.name || appt.name,
      barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
      data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
      horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      profissional: appt.profiles?.responsible_name || "Seu Barbeiro",
      servico: appt.services?.name || "Serviço",
    };

    const processedMessage = processAutomationTemplate(automation.template, variables);
    const result = await sendMessage(connection, phone, processedMessage);
    
    if (result.success) {
      await supabase.from("appointments").update({ confirmation_sent: true }).eq("id", appt.id);
    }

    const logEntry = {
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
      error_message: result.error,
      sent_at: new Date().toISOString()
    };

    await supabase.from("automation_logs").insert(logEntry);
    sentItems.push({ ...logEntry, customer_name: variables.cliente_nome });
  }

  return { appointments, sentItems, ignored };
}

async function processAppointmentReminder(supabase: any, automation: any, connection: any) {
  const delayHours = automation.trigger_delay || 24;
  const targetTimeStart = new Date(Date.now() + (delayHours * 60 * 60 * 1000)).toISOString();
  const targetTimeEnd = new Date(Date.now() + (delayHours * 60 * 60 * 1000) + (15 * 60 * 1000)).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*, customers(*), profiles:barber_id(*), services:service_id(*)")
    .eq("barber_id", automation.barber_id)
    .eq("status", "scheduled")
    .eq("reminder_sent", false)
    .gte("start_time", targetTimeStart)
    .lte("start_time", targetTimeEnd);

  if (error) return { appointments: [], errors: [error.message] };
  if (!appointments || appointments.length === 0) return { appointments: [] };

  const sentItems = [];
  const ignored = [];

  for (const appt of appointments) {
    const phone = appt.customers?.phone || appt.phone;
    if (!phone) {
      ignored.push({ appointment_id: appt.id, reason: "Cliente sem telefone cadastrado" });
      continue;
    }

    const variables = {
      cliente_nome: appt.customers?.name || appt.name,
      barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
      data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
      horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      profissional: appt.profiles?.responsible_name || "Seu Barbeiro",
      servico: appt.services?.name || "Serviço",
    };

    const processedMessage = processAutomationTemplate(automation.template, variables);
    const result = await sendMessage(connection, phone, processedMessage);
    
    if (result.success) {
      await supabase.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);
    }

    const logEntry = {
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
      error_message: result.error,
      sent_at: new Date().toISOString()
    };

    await supabase.from("automation_logs").insert(logEntry);
    sentItems.push({ ...logEntry, customer_name: variables.cliente_nome });
  }

  return { appointments, sentItems, ignored };
}

async function sendMessage(connection: any, phone: string, message: string) {
  try {
    const instanceId = connection.instance_id;
    const token = connection.instance_token;
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const baseUrl = connection.server_url || "https://api.z-api.io";
    
    const targetPhone = normalizePhone(phone);
    const headers: any = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;

    const response = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: targetPhone, message: message })
    });

    const data = await response.json();
    return { 
      success: response.ok, 
      response: data, 
      error: !response.ok ? (data.message || data.error || `HTTP ${response.status}`) : null 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
