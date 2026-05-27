import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationTemplate } from "../_shared/template-parser.ts";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const serverTime = new Date().toISOString();
  
  console.log(`[Automation] Multi-tenant Execution Started. Server: ${serverTime}`);

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

    const { data: statusRows } = await supabase.from("automation_status").select("id").limit(1);
    const globalStatusId = statusRows?.[0]?.id;

    if (globalStatusId) {
      await supabase.from("automation_status").update({
        status: 'executing',
        server_time: serverTime,
        timezone: "America/Sao_Paulo"
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

        const { data: connection, error: connError } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (connError || !connection || !connection.instance_id || !connection.token) {
          if (automations && automations.length > 0) {
            ignoredRecords.push({ 
              tenant_id: tenantId, 
              business_name: tenant.business_name,
              reason: "Instância Z-API não configurada ou inválida" 
            });
          }
          continue;
        }

        try {
          const baseUrl = connection.server_url || "https://api.z-api.io";
          const statusUrl = `${baseUrl}/instances/${connection.instance_id}/token/${connection.token}/status`;
          
          const headers: any = { "Content-Type": "application/json" };
          if (connection.client_token) {
            headers["Client-Token"] = connection.client_token;
          }

          const statusRes = await fetch(statusUrl, { method: "GET", headers });
          const statusData = await statusRes.json();
          
          if (statusData?.connected === true) {
            connection.status = 'connected';
            connection.connected = true;
          } else {
            connection.status = 'disconnected';
            connection.connected = false;
          }
        } catch (statusErr) {
          console.error(`[Automation] Failed to check live status for ${tenant.business_name}:`, statusErr);
          connection.status = 'disconnected';
        }

        if (connection.status !== 'connected') {
          if (automations && automations.length > 0) {
            ignoredRecords.push({ 
              tenant_id: tenantId, 
              business_name: tenant.business_name,
              reason: "WhatsApp desconectado" 
            });
          }
          continue;
        }

        for (const automation of automations || []) {
          try {
            let res: any = { found: 0, sent: 0, failed: 0 };
            
            if (automation.type === "birthday") {
              res = await processBirthdayAutomation(supabase, automation, connection, forceMode);
            } else if (automation.type === "appointment_confirmation") {
              res = await processAppointmentConfirmation(supabase, automation, connection, forceMode);
            } else if (automation.type === "appointment_reminder") {
              res = await processAppointmentReminder(supabase, automation, connection, forceMode);
            } else {
              continue;
            }

            if (res.appointments) appointmentsFound.push(...res.appointments.map((a:any) => ({ ...a, tenant_id: tenantId })));
            if (res.birthdays) birthdaysFound.push(...res.birthdays.map((b:any) => ({ ...b, tenant_id: tenantId })));
            if (res.sentItems) messagesSent.push(...res.sentItems.map((s:any) => ({ ...s, tenant_id: tenantId })));

          } catch (autoRunErr) {
            errors.push(`Automation ${automation.name} for ${tenant.business_name}: ${autoRunErr.message}`);
          }
        }
      } catch (tenantErr) {
        errors.push(`Error processing tenant ${tenant.business_name}: ${tenantErr.message}`);
      }
    }

    const duration = Date.now() - startTime;
    const finalResult = {
      success: true,
      execution_time_ms: duration,
      tenants_processed: tenants?.length || 0,
      appointments_processed: appointmentsFound.length,
      birthdays_processed: birthdaysFound.length,
      messages_sent: messagesSent.filter(m => m.status === "success").length,
      messages_failed: messagesSent.filter(m => m.status === "error").length,
      ignored_tenants: ignoredRecords,
      errors: errors.length > 0 ? errors : null
    };

    if (globalStatusId) {
      await supabase.from("automation_status").update({
        status: 'idle',
        last_run: serverTime,
        last_result: finalResult
      }).eq('id', globalStatusId);
    }

    console.log("[Automation] Execution Finished:", JSON.stringify(finalResult));

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[Automation] Global Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message, serverTime, timezone: "America/Sao_Paulo" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

async function processBirthdayAutomation(supabase: any, automation: any, connection: any, forceMode: boolean) {
  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", automation.tenant_id)
    .not("birth_date", "is", null);

  if (error) return { birthdays: [], errors: [error.message] };
  
  const now = new Date();
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');

  const bdayCustomers = customers?.filter((c: any) => {
    if (!c.birth_date) return false;
    const parts = c.birth_date.split('-');
    if (parts.length < 3) return false;
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    return day === todayDay && month === todayMonth;
  });

  if (!bdayCustomers || bdayCustomers.length === 0) {
    return { birthdays: [], ignored: [{ reason: `Nenhum aniversariante hoje.`, type: 'birthday' }] };
  }

  const birthdays = bdayCustomers.map(c => ({ id: c.id, name: c.name, type: 'birthday' }));
  const sentItems = [];
  const ignored = [];

  for (const customer of bdayCustomers) {
    try {
      const todayISO = now.toISOString().split('T')[0];
      
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
        barbearia_nome: "Nossa Barbearia",
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
    .eq("confirmation_sent", false)
    .eq("status", "scheduled");

  if (!forceMode) {
    query = query.gte("created_at", fifteenMinutesAgo);
  }
  
  const { data: appointments, error } = await query;

  if (error) return { appointments: [], errors: [error.message] };
  if (!appointments || appointments.length === 0) {
    return { appointments: [], ignored: [{ reason: "Nenhum pendente.", type: 'confirmation' }] };
  }

  // Group appointments by customer and appointment_group_id (or just customer if group_id is null)
  const groupedAppointments: Record<string, any[]> = {};
  for (const appt of appointments) {
    const key = appt.appointment_group_id || `single_${appt.id}`;
    if (!groupedAppointments[key]) groupedAppointments[key] = [];
    groupedAppointments[key].push(appt);
  }

  const sentItems = [];
  const ignored = [];

  for (const groupKey in groupedAppointments) {
    const group = groupedAppointments[groupKey];
    const firstAppt = group[0];
    const phone = firstAppt.customers?.phone || firstAppt.phone;

    if (!phone) {
      ignored.push({ 
        appointment_ids: group.map(a => a.id), 
        customer_name: firstAppt.customers?.name || firstAppt.name, 
        reason: "Sem telefone", 
        type: 'confirmation' 
      });
      continue;
    }

    try {
      const customerName = firstAppt.customers?.name || firstAppt.name;
      const businessName = firstAppt.profiles?.business_name || "Nossa Barbearia";
      
      let message = `Olá ${customerName} 👋\n\n`;
      message += `Seu agendamento na ${businessName} foi realizado com sucesso!\n\n`;
      
      if (group.length > 1) {
        message += `Você possui ${group.length} atendimentos:\n\n`;
        group.forEach((appt, index) => {
          message += `${index + 1}️⃣ Serviço: ${appt.services?.name || "Serviço"}\n`;
          message += `💈 Profissional: ${appt.barbers?.name || "Seu Barbeiro"}\n`;
          message += `📅 Data: ${formatBrazilDate(appt.start_time)}\n`;
          message += `⏰ Horário: ${formatBrazilTime(appt.start_time)}\n\n`;
        });
      } else {
        message += `Detalhes do seu agendamento:\n\n`;
        message += `✅ Serviço: ${firstAppt.services?.name || "Serviço"}\n`;
        message += `💈 Profissional: ${firstAppt.barbers?.name || "Seu Barbeiro"}\n`;
        message += `📅 Data: ${formatBrazilDate(firstAppt.start_time)}\n`;
        message += `⏰ Horário: ${formatBrazilTime(firstAppt.start_time)}\n\n`;
      }

      const buttons = [
        { id: '1', label: 'Confirmar' },
        { id: '2', label: 'Reagendar' },
        { id: '3', label: 'Cancelar' }
      ];

      const result = await sendMessage(connection, phone, message, {
        buttons,
        title: "Confirmação de Agendamento",
        footer: businessName
      });
      
      const status = result.success ? "success" : "error";
      
      // Log for each appointment in the group
      for (const appt of group) {
        const logEntry = {
          automation_id: automation.id,
          tenant_id: automation.tenant_id,
          customer_id: appt.customer_id,
          appointment_id: appt.id,
          barber_id: appt.barber_id,
          status,
          message_type: "appointment_confirmation",
          phone: normalizePhone(phone),
          original_template: automation.template,
          processed_template: message,
          response: result.response,
          error_message: result.error,
          sent_at: new Date().toISOString()
        };
        await supabase.from("automation_logs").insert(logEntry);
        await supabase.from("appointments").update({ confirmation_sent: true }).eq("id", appt.id);
      }
      
      if (result.success) {
        // Create conversation state
        const normalizedPhone = normalizePhone(phone);
        
        // Check for existing active conversation and deactivate it
        await supabase.from("whatsapp_conversations")
          .update({ active: false })
          .eq("phone", normalizedPhone)
          .eq("active", true);

        await supabase.from("whatsapp_conversations").insert({
          barber_id: automation.tenant_id,
          customer_id: firstAppt.customer_id,
          appointment_id: group.length === 1 ? firstAppt.id : null,
          appointment_group_id: firstAppt.appointment_group_id,
          phone: normalizedPhone,
          state: 'awaiting_main_action',
          active: true,
          context: {
            customer_name: customerName,
            business_name: businessName,
            appointments: group.map(a => ({
              id: a.id,
              service_name: a.services?.name,
              barber_name: a.barbers?.name,
              start_time: a.start_time,
              barber_id: a.barber_id,
              service_id: a.service_id
            }))
          }
        });

        sentItems.push({ customer_name: customerName, status: "success" });
      } else {
        sentItems.push({ customer_name: customerName, status: "error", error_message: result.error });
      }

    } catch (err) {
      sentItems.push({ status: 'error', error_message: err.message });
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
    return { appointments: [], ignored: [{ reason: "Fora da janela.", type: 'reminder' }] };
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

      const variables = {
        cliente_nome: appt.customers?.name || appt.name,
        barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
        data: formatBrazilDate(appt.start_time),
        horario: formatBrazilTime(appt.start_time),
        profissional: appt.barbers?.name || "Seu Barbeiro",
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
      sentItems.push({ status: 'error', appointment_id: appt.id, error_message: err.message, type: 'reminder' });
    }
  }

  return { appointments, sentItems, ignored };
}

async function sendMessage(connection: any, phone: string, message: string) {
  try {
    const instanceId = connection.instance_id;
    const token = connection.token;
    const clientToken = connection.client_token;
    const baseUrl = connection.server_url || "https://api.z-api.io";
    
    const targetPhone = normalizePhone(phone);
    const headers: any = { "Content-Type": "application/json" };
    
    if (clientToken) {
      headers["Client-Token"] = clientToken;
    }

    const sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
    
    const response = await fetch(sendUrl, {
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
