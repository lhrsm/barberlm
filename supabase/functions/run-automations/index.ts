import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationTemplate } from "../_shared/template-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBRTimeInfo() {
  const now = new Date();
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
  
  console.log(`[Automation] Multi-tenant Execution Started. Server: ${serverTime}, BR: ${brTime.iso}`);

  try {
    const body = await req.json().catch(() => ({}));
    const targetTenantId = body.tenantId;
    const forceMode = body.forceMode === true;

    let tenantQuery = supabase.from("profiles").select("id, business_name").eq("role", "tenant_admin");
    if (targetTenantId) {
      tenantQuery = tenantQuery.eq("id", targetTenantId);
    }
    const { data: tenants, error: tenantError } = await tenantQuery;
    if (tenantError) throw tenantError;

    console.log(`[Automation] Processing ${tenants?.length || 0} tenants.`);

    // Status global
    const { data: statusRows } = await supabase.from("automation_status").select("id").limit(1);
    const globalStatusId = statusRows?.[0]?.id;

    if (globalStatusId) {
      await supabase.from("automation_status").update({
        status: 'executing',
        server_time: serverTime,
        timezone: "America/Bahia"
      }).eq('id', globalStatusId);
    }

    for (const tenant of tenants || []) {
      const tenantId = tenant.id;
      
      try {
        const { data: automations, error: autoError } = await supabase
          .from("automations")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("enabled", true);

        if (autoError) {
          errors.push(`Tenant ${tenant.business_name} (${tenantId}): ${autoError.message}`);
          continue;
        }

        let { data: connection } = await supabase
          .from("whatsapp_connections")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!connection) {
          if (automations && automations.length > 0) {
            ignoredRecords.push({ 
              tenant_id: tenantId, 
              business_name: tenant.business_name,
              reason: "WhatsApp da barbearia não configurado" 
            });
          }
          continue;
        }

        // Live check if not marked as connected in DB
        if (connection.status !== 'connected') {
          console.log(`[Automation] DB status is ${connection.status} for ${tenant.business_name}. Performing live check...`);
          try {
            const statusUrl = `${connection.server_url || "https://api.z-api.io"}/instances/${connection.instance_id}/token/${connection.instance_token}/status`;
            const statusRes = await fetch(statusUrl, { method: "GET" });
            const statusData = await statusRes.json();
            
            console.log(`[Automation] ZAPI STATUS RESPONSE for ${tenant.business_name}:`, JSON.stringify(statusData));
            console.log(`[Automation] CONNECTED?`, statusData?.connected);
            
            // Strict validation as requested by user
            if (statusData?.connected === true) {
              console.log(`[Automation] Instance is ACTUALLY connected. Updating DB status.`);
              await supabase.from("whatsapp_connections").update({ status: 'connected', connected: true, updated_at: new Date().toISOString() }).eq("id", connection.id);
              connection.status = 'connected';
            } else {
              console.log(`[Automation] Instance is indeed disconnected.`);
            }
          } catch (statusErr) {
            console.error(`[Automation] Failed to check live status for ${tenant.business_name}:`, statusErr);
          }
        }

        if (connection.status !== 'connected') {
          if (automations && automations.length > 0) {
            ignoredRecords.push({ 
              tenant_id: tenantId, 
              business_name: tenant.business_name,
              reason: "WhatsApp da barbearia não conectado" 
            });
          }
          continue;
        }

        for (const automation of automations || []) {
          try {
            console.log(`[Automation] Processing ${automation.type} for tenant ${tenant.business_name}`);
            let res: any = { found: 0, sent: 0, failed: 0 };
            
            if (automation.type === "birthday") {
              res = await processBirthdayAutomation(supabase, automation, connection, brTime, forceMode);
            } else if (automation.type === "appointment_confirmation") {
              res = await processAppointmentConfirmation(supabase, automation, connection, forceMode);
            } else if (automation.type === "appointment_reminder") {
              res = await processAppointmentReminder(supabase, automation, connection, forceMode);
            } else {
              console.log(`[Automation] Type ${automation.type} not implemented yet.`);
              continue;
            }

            if (res.appointments) appointmentsFound.push(...res.appointments.map((a:any) => ({ ...a, tenant_id: tenantId })));
            if (res.birthdays) birthdaysFound.push(...res.birthdays.map((b:any) => ({ ...b, tenant_id: tenantId })));
            if (res.sentItems) messagesSent.push(...res.sentItems.map((s:any) => ({ ...s, tenant_id: tenantId })));
            if (res.errors) errors.push(...res.errors.map((e:string) => `Tenant ${tenant.business_name}: ${e}`));
            if (res.ignored) ignoredRecords.push(...res.ignored.map((i:any) => ({ ...i, tenant_id: tenantId })));
          } catch (autoLoopErr) {
            console.error(`[Automation] Error processing automation ${automation.type} for tenant ${tenantId}:`, autoLoopErr);
            // Salvar log de erro mesmo se a função de processamento falhar catastroficamente
            try {
              await supabase.from("automation_logs").insert({
                automation_id: automation.id,
                tenant_id: tenantId,
                status: "error",
                message_type: automation.type,
                error_message: `Internal processing error: ${autoLoopErr.message}`,
                sent_at: new Date().toISOString()
              });
            } catch (logErr) {
              console.error("[Automation] Critical failure to log error:", logErr);
            }
            errors.push(`Tenant ${tenant.business_name} - Automação ${automation.type}: ${autoLoopErr.message}`);
          }
        }
      } catch (tenantLoopErr) {
        console.error(`[Automation] Critical error for tenant ${tenantId}:`, tenantLoopErr);
        errors.push(`Tenant ${tenant.business_name}: ${tenantLoopErr.message}`);
      }
    }

    const executionTime = `${Date.now() - startTime}ms`;
    
    // Update global status
    if (globalStatusId) {
      await supabase.from("automation_status").update({
        status: 'active',
        last_run_at: serverTime,
        total_processed: appointmentsFound.length + birthdaysFound.length,
        messages_sent: messagesSent.filter(m => m.status === 'success').length,
        messages_failed: messagesSent.filter(m => m.status === 'error').length,
        last_error: errors.length > 0 ? errors.slice(0, 3).join("; ") : null
      }).eq("id", globalStatusId);
    }

    const responseData = {
      success: true,
      serverTime,
      brTime: brTime.iso,
      timezone: "America/Bahia",
      forceMode,
      appointmentsFound,
      birthdaysFound,
      messagesSent,
      ignoredRecords,
      errors,
      executionTime,
      summary: {
        tenants_processed: tenants?.length || 0,
        records_found: appointmentsFound.length + birthdaysFound.length,
        messages_sent: messagesSent.filter(m => m.status === 'success').length,
        messages_failed: messagesSent.filter(m => m.status === 'error').length,
        ignored: ignoredRecords.length,
        errors
      }
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[Automation] Global Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message, serverTime, timezone: "America/Bahia" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

async function processBirthdayAutomation(supabase: any, automation: any, connection: any, brTime: any, forceMode: boolean) {
  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", automation.tenant_id)
    .not("birth_date", "is", null);

  if (error) return { birthdays: [], errors: [error.message] };
  
  const bdayCustomers = customers?.filter((c: any) => {
    if (!c.birth_date) return false;
    const parts = c.birth_date.split('-');
    if (parts.length < 3) return false;
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    return day === brTime.day && month === brTime.month;
  });

  if (!bdayCustomers || bdayCustomers.length === 0) {
    return { 
      birthdays: [], 
      ignored: [{ 
        reason: `Nenhum aniversariante hoje (${brTime.day}/${brTime.month}).`,
        type: 'birthday'
      }] 
    };
  }

  const birthdays = bdayCustomers.map(c => ({ id: c.id, name: c.name, type: 'birthday' }));
  const sentItems = [];
  const ignored = [];

  for (const customer of bdayCustomers) {
    try {
      const todayISO = `${brTime.year}-${brTime.month}-${brTime.day}`;
      
      if (!forceMode) {
        const { data: existing } = await supabase
          .from("automation_logs")
          .select("id")
          .eq("automation_id", automation.id)
          .eq("customer_id", customer.id)
          .eq("message_type", "birthday")
          .filter('created_at', 'gte', `${todayISO}T00:00:00`)
          .maybeSingle();

        if (existing) {
          ignored.push({ customer_id: customer.id, customer_name: customer.name, reason: "Aniversário já enviado hoje", type: 'birthday' });
          continue;
        }
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
      
      if (result.success) {
        await supabase.from("customers").update({ birthday_sent: true }).eq("id", customer.id);
        sentItems.push({ ...logEntry, customer_name: customer.name });
      } else {
        sentItems.push({ ...logEntry, customer_name: customer.name, error_message: result.error, type: 'birthday' });
      }
    } catch (err) {
      console.error(`Error processing birthday for ${customer.id}:`, err);
      sentItems.push({ status: 'error', customer_name: customer.name, error_message: err.message, type: 'birthday' });
    }
  }

  return { birthdays, sentItems, ignored };
}

async function processAppointmentConfirmation(supabase: any, automation: any, connection: any, forceMode: boolean) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  let query = supabase
    .from("appointments")
    .select("*, customers(*), profiles:tenant_id(*), services:service_id(*), barbers:barber_id(*)")
    .eq("tenant_id", automation.tenant_id)
    .eq("confirmation_sent", false);

  if (!forceMode) {
    query = query.gte("created_at", fifteenMinutesAgo);
  }
  
  const { data: appointments, error } = await query;

  if (error) return { appointments: [], errors: [error.message] };
  if (!appointments || appointments.length === 0) {
    return { 
      appointments: [], 
      ignored: [{ 
        reason: forceMode ? "Nenhum pendente de confirmação." : "Nenhum criado nos últimos 15min.",
        type: 'confirmation'
      }] 
    };
  }

  const sentItems = [];
  const ignored = [];

  for (const appt of appointments) {
    try {
      const phone = appt.customers?.phone || appt.phone;
      if (!phone) {
        ignored.push({ appointment_id: appt.id, customer_name: appt.customers?.name || appt.name, reason: "Sem telefone", type: 'confirmation' });
        continue;
      }

      const variables = {
        cliente_nome: appt.customers?.name || appt.name,
        barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
        data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
        horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        profissional: appt.barbers?.name || appt.profiles?.responsible_name || "Seu Barbeiro",
        servico: appt.services?.name || "Serviço",
      };

      const processedMessage = processAutomationTemplate(automation.template, variables);
      const result = await sendMessage(connection, phone, processedMessage);
      
      const logEntry = {
        automation_id: automation.id,
        tenant_id: automation.tenant_id,
        customer_id: appt.customer_id,
        appointment_id: appt.id,
        barber_id: appt.barber_id,
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
      
      if (result.success) {
        await supabase.from("appointments").update({ confirmation_sent: true }).eq("id", appt.id);
        sentItems.push({ ...logEntry, customer_name: variables.cliente_nome });
      } else {
        sentItems.push({ ...logEntry, customer_name: variables.cliente_nome, error_message: result.error, type: 'confirmation' });
      }
    } catch (err) {
      console.error(`Error processing confirmation for ${appt.id}:`, err);
      sentItems.push({ status: 'error', appointment_id: appt.id, error_message: err.message, type: 'confirmation' });
    }
  }

  return { appointments, sentItems, ignored };
}

async function processAppointmentReminder(supabase: any, automation: any, connection: any, forceMode: boolean) {
  const delayHours = automation.trigger_delay || 24;
  const now = Date.now();
  const targetTimeStart = new Date(now + (delayHours * 60 * 60 * 1000)).toISOString();
  const targetTimeEnd = new Date(now + (delayHours * 60 * 60 * 1000) + (15 * 60 * 1000)).toISOString();

  let query = supabase
    .from("appointments")
    .select("*, customers(*), profiles:tenant_id(*), services:service_id(*), barbers:barber_id(*)")
    .eq("tenant_id", automation.tenant_id)
    .eq("status", "scheduled")
    .eq("reminder_sent", false);

  if (!forceMode) {
    query = query.gte("start_time", targetTimeStart).lte("start_time", targetTimeEnd);
  }

  const { data: appointments, error } = await query;

  if (error) return { appointments: [], errors: [error.message] };
  if (!appointments || appointments.length === 0) {
    return { 
      appointments: [], 
      ignored: [{ 
        reason: forceMode ? "Nenhum pendente de lembrete." : `Fora da janela de ${delayHours}h.`,
        type: 'reminder'
      }] 
    };
  }

  const sentItems = [];
  const ignored = [];

  for (const appt of appointments) {
    try {
      const phone = appt.customers?.phone || appt.phone;
      if (!phone) {
        ignored.push({ appointment_id: appt.id, customer_name: appt.customers?.name || appt.name, reason: "Sem telefone", type: 'reminder' });
        continue;
      }

      const apptStartTime = new Date(appt.start_time).getTime();
      const diffMinutes = Math.floor((apptStartTime - now) / (60 * 1000));

      if (!forceMode && (diffMinutes < (delayHours * 60) || diffMinutes > (delayHours * 60 + 15))) {
          ignored.push({ 
              appointment_id: appt.id, 
              customer_name: appt.customers?.name || appt.name, 
              reason: `Fora da janela (${diffMinutes} min).`,
              type: 'reminder'
          });
          continue;
      }

      const variables = {
        cliente_nome: appt.customers?.name || appt.name,
        barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
        data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
        horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        profissional: appt.barbers?.name || appt.profiles?.responsible_name || "Seu Barbeiro",
        servico: appt.services?.name || "Serviço",
      };

      const processedMessage = processAutomationTemplate(automation.template, variables);
      const result = await sendMessage(connection, phone, processedMessage);
      
      const logEntry = {
        automation_id: automation.id,
        tenant_id: automation.tenant_id,
        customer_id: appt.customer_id,
        appointment_id: appt.id,
        barber_id: appt.barber_id,
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
      
      if (result.success) {
        await supabase.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);
        sentItems.push({ ...logEntry, customer_name: variables.cliente_nome });
      } else {
        sentItems.push({ ...logEntry, customer_name: variables.cliente_nome, error_message: result.error, type: 'reminder' });
      }
    } catch (err) {
      console.error(`Error processing reminder for ${appt.id}:`, err);
      sentItems.push({ status: 'error', appointment_id: appt.id, error_message: err.message, type: 'reminder' });
    }
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