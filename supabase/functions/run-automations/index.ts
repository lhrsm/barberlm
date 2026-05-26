import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Running scheduled automations...");

    // 1. Fetch all active automations
    const { data: automations, error: autoError } = await supabase
      .from("automations")
      .select("*")
      .eq("enabled", true);

    if (autoError) throw autoError;

    const results = [];

    for (const automation of automations) {
      console.log(`Processing automation: ${automation.type} for barber: ${automation.barber_id}`);
      
      // Get WhatsApp connection for this barber
      const { data: connection } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("barber_id", automation.barber_id)
        .eq("status", "connected")
        .maybeSingle();

      if (!connection) {
        console.warn(`No connected WhatsApp for barber ${automation.barber_id}`);
        continue;
      }

      if (automation.type === "birthday") {
        results.push(await processBirthdayAutomation(supabase, automation, connection));
      } else if (automation.type === "appointment_confirmation") {
        results.push(await processAppointmentConfirmation(supabase, automation, connection));
      } else if (automation.type === "appointment_reminder") {
        results.push(await processAppointmentReminder(supabase, automation, connection));
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Automation Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function processBirthdayAutomation(supabase: any, automation: any, connection: any) {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const birthdayStr = `${month}-${day}`; // Format MM-DD for matching

  // Find customers with birthday today
  // In Postgres: birth_date::text LIKE '%MM-DD'
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("barber_id", automation.barber_id);
  
  const bdayCustomers = customers?.filter((c: any) => {
    if (!c.birth_date) return false;
    return c.birth_date.endsWith(birthdayStr);
  });

  if (!bdayCustomers || bdayCustomers.length === 0) return { type: "birthday", sent: 0 };

  let sentCount = 0;
  for (const customer of bdayCustomers) {
    // Check if already sent today
    const { data: existing } = await supabase
      .from("automation_logs")
      .select("id")
      .eq("automation_id", automation.id)
      .eq("customer_id", customer.id)
      .gte("sent_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .maybeSingle();

    if (existing) continue;

    const message = replaceVariables(automation.template, {
      cliente_nome: customer.name,
      barbearia_nome: "Nossa Barbearia", // Fetch from profile if possible
    });

    const result = await sendMessage(connection, customer.phone, message);
    
    await supabase.from("automation_logs").insert({
      automation_id: automation.id,
      barber_id: automation.barber_id,
      customer_id: customer.id,
      status: result.success ? "success" : "error",
      message_type: "birthday",
      phone: customer.phone,
      response: result.response,
      error_message: result.error
    });

    if (result.success) sentCount++;
  }

  return { type: "birthday", sent: sentCount };
}

async function processAppointmentConfirmation(supabase: any, automation: any, connection: any) {
  // Find appointments created in the last 10 minutes that haven't been notified
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, customers(*), profiles!appointments_barber_id_fkey(*)")
    .eq("barber_id", automation.barber_id)
    .gte("created_at", tenMinutesAgo);

  if (!appointments || appointments.length === 0) return { type: "confirmation", sent: 0 };

  let sentCount = 0;
  for (const appt of appointments) {
    const { data: existing } = await supabase
      .from("automation_logs")
      .select("id")
      .eq("appointment_id", appt.id)
      .eq("message_type", "appointment_confirmation")
      .maybeSingle();

    if (existing) continue;

    const message = replaceVariables(automation.template, {
      cliente_nome: appt.customers?.name || appt.name,
      barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
      data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
      horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      profissional: appt.profiles?.responsible_name || "Seu Barbeiro",
    });

    const phone = appt.customers?.phone || appt.phone;
    if (!phone) continue;

    const result = await sendMessage(connection, phone, message);
    
    await supabase.from("automation_logs").insert({
      automation_id: automation.id,
      barber_id: automation.barber_id,
      customer_id: appt.customer_id,
      appointment_id: appt.id,
      status: result.success ? "success" : "error",
      message_type: "appointment_confirmation",
      phone: phone,
      response: result.response,
      error_message: result.error
    });

    if (result.success) sentCount++;
  }

  return { type: "confirmation", sent: sentCount };
}

async function processAppointmentReminder(supabase: any, automation: any, connection: any) {
  // Find appointments starting in trigger_delay minutes (± 5 minutes window)
  const delayMinutes = automation.trigger_delay || 60;
  const targetTimeStart = new Date(Date.now() + (delayMinutes - 5) * 60 * 1000).toISOString();
  const targetTimeEnd = new Date(Date.now() + (delayMinutes + 5) * 60 * 1000).toISOString();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, customers(*), profiles!appointments_barber_id_fkey(*)")
    .eq("barber_id", automation.barber_id)
    .gte("start_time", targetTimeStart)
    .lte("start_time", targetTimeEnd);

  if (!appointments || appointments.length === 0) return { type: "reminder", sent: 0 };

  let sentCount = 0;
  for (const appt of appointments) {
    const { data: existing } = await supabase
      .from("automation_logs")
      .select("id")
      .eq("appointment_id", appt.id)
      .eq("message_type", "appointment_reminder")
      .maybeSingle();

    if (existing) continue;

    const message = replaceVariables(automation.template, {
      cliente_nome: appt.customers?.name || appt.name,
      barbearia_nome: appt.profiles?.business_name || "Nossa Barbearia",
      data: new Date(appt.start_time).toLocaleDateString('pt-BR'),
      horario: new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });

    const phone = appt.customers?.phone || appt.phone;
    if (!phone) continue;

    const result = await sendMessage(connection, phone, message);
    
    await supabase.from("automation_logs").insert({
      automation_id: automation.id,
      barber_id: automation.barber_id,
      customer_id: appt.customer_id,
      appointment_id: appt.id,
      status: result.success ? "success" : "error",
      message_type: "appointment_reminder",
      phone: phone,
      response: result.response,
      error_message: result.error
    });

    if (result.success) sentCount++;
  }

  return { type: "reminder", sent: sentCount };
}

function replaceVariables(template: string, vars: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

async function sendMessage(connection: any, phone: string, message: string) {
  try {
    const instanceId = connection.instance_id;
    const token = connection.instance_token;
    const cleanPhone = phone.replace(/\D/g, "");
    
    // Ensure phone has country code if missing (DDI 55 for Brazil)
    const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;

    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message
      })
    });

    const data = await response.json();
    return { success: response.ok, response: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
