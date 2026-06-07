import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getNowBrazil, formatBrazilTime } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { action } = await req.json().catch(() => ({}));
    
    console.log('[AutomationEngine] Start', { action });

    // 1. Process Appointment Reminders
    await scheduleAppointmentReminders(supabase);

    // 2. Process Birthdays
    await scheduleBirthdayMessages(supabase);

    // 3. Trigger Queue Processing
    const { data: queueResult, error: queueError } = await supabase.functions.invoke('process-automation-queue', {
      body: {}
    });

    if (queueError) console.error("[AutomationEngine] Queue error:", queueError);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Engine cycle completed",
      queue_result: queueResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[AutomationEngine] Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function scheduleAppointmentReminders(supabase: any) {
  console.log("[AutomationEngine] Checking for appointment reminders...");
  
  // Find appointments scheduled for the future that don't have reminders queued yet
  // Rule: appointment.start_time - appointment.created_at >= 12 hours
  const now = new Date().toISOString();
  
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(`
      id, 
      tenant_id, 
      customer_id, 
      start_time, 
      created_at, 
      status
    `)
    .in("status", ["scheduled", "confirmed", "awaiting_payment"])
    .gt("start_time", now)
    .order("start_time", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[AutomationEngine] Appointments error:", error);
    return;
  }
  
  console.log(`[AutomationEngine] Found ${appointments?.length || 0} potential appointments`);
  
  for (const app of appointments) {
    const startTime = new Date(app.start_time);
    const createdAt = new Date(app.created_at);
    const diffHours = (startTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    console.log(`[AutomationEngine] Checking app ${app.id}: diffHours=${diffHours.toFixed(1)}`);

    if (diffHours < 12) continue;

    const { data: reminderTemplate } = await supabase
      .from("automation_templates")
      .select("id")
      .eq("tenant_id", app.tenant_id)
      .eq("key", "appointment_reminder")
      .eq("active", true)
      .maybeSingle();

    if (!reminderTemplate) {
      console.log(`[AutomationEngine] No active reminder template for tenant ${app.tenant_id}`);
      continue;
    }

    const intervals = [
      { type: "6h", minutes: 360 },
      { type: "1h", minutes: 60 },
      { type: "30m", minutes: 30 }
    ];

    for (const interval of intervals) {
      const scheduledFor = new Date(startTime.getTime() - interval.minutes * 60000);
      
      // Skip if the time has already passed
      if (scheduledFor.getTime() < new Date().getTime()) continue;

      try {
        const { error: insertError } = await supabase.from("automation_queue").insert({
          tenant_id: app.tenant_id,
          automation_id: reminderTemplate.id,
          appointment_id: app.id,
          customer_id: app.customer_id,
          workflow_key: "appointment_reminder",
          event_name: "appointment.reminder",
          status: "pending",
          scheduled_for: scheduledFor.toISOString(),
          payload: { reminder_type: interval.type }
        });
        
        if (insertError) {
          if (insertError.code !== '23505') { // Not a unique violation
            console.error(`[AutomationEngine] Insert error for ${interval.type}:`, insertError);
          }
        } else {
          console.log(`[AutomationEngine] Scheduled ${interval.type} reminder for app ${app.id}`);
        }
      } catch (e) {
        // Silent
      }
    }
  }
}

async function scheduleBirthdayMessages(supabase: any) {
  console.log("[AutomationEngine] Checking for birthdays...");
  
  const nowBrazil = getNowBrazil();
  const day = nowBrazil.getDate();
  const month = nowBrazil.getMonth() + 1;
  const year = nowBrazil.getFullYear();
  
  // Rule: Window 09:00 - 11:59 AM (Sao Paulo)
  const hourStr = formatBrazilTime(nowBrazil).split(':')[0];
  const hour = parseInt(hourStr);

  if (hour < 9) {
    console.log(`[AutomationEngine] Too early for birthdays (${hourStr}:00). Waiting for 09:00 AM.`);
    return;
  }
  if (hour >= 12) {
    console.log(`[AutomationEngine] Too late for birthdays (${hourStr}:00). Window closed at 11:59 AM.`);
    return;
  }

  // Find customers whose birthday is today
  const { data: customers, error } = await supabase.rpc('get_customers_with_birthday_today', {
    target_day: day,
    target_month: month
  });

  if (error || !customers) {
    console.error("[AutomationEngine] Birthday check error:", error);
    return;
  }

  console.log(`[AutomationEngine] Found ${customers.length} customers with birthday today`);

  for (const customer of customers) {
    try {
      // 1. Double check if already sent in automation_v2_dispatches this year
      // The database constraint is the ultimate source of truth, but we check here for better logging
      const { data: existingDispatch, error: dispatchError } = await supabase
        .from("automation_v2_dispatches")
        .select("id")
        .eq("tenant_id", customer.tenant_id)
        .eq("customer_id", customer.id)
        .eq("workflow_key", "customer_birthday")
        .eq("birthday_year", year)
        .maybeSingle();

      if (dispatchError) {
        console.error(`[AutomationEngine] Error checking dispatch for ${customer.id}:`, dispatchError);
      }

      if (existingDispatch) {
        console.log(`[AutomationEngine] Birthday already sent this year for customer ${customer.id} (${customer.name})`);
        continue;
      }

      // 2. Check if already in queue for this year
      const { data: existingQueue, error: queueCheckError } = await supabase
        .from("automation_queue")
        .select("id")
        .eq("tenant_id", customer.tenant_id)
        .eq("customer_id", customer.id)
        .eq("workflow_key", "customer_birthday")
        .eq("reference_year", year)
        .maybeSingle();
      
      if (queueCheckError) {
        console.error(`[AutomationEngine] Error checking queue for ${customer.id}:`, queueCheckError);
      }

      if (existingQueue) {
        console.log(`[AutomationEngine] Birthday already in queue for customer ${customer.id} (${customer.name})`);
        continue;
      }

      const { data: bdayTemplate } = await supabase
        .from("automation_templates")
        .select("id")
        .eq("tenant_id", customer.tenant_id)
        .eq("key", "customer_birthday")
        .eq("active", true)
        .maybeSingle();

      if (!bdayTemplate) {
        console.log(`[AutomationEngine] No active birthday template for tenant ${customer.tenant_id}`);
        continue;
      }

      // Default to 09:00 AM Brazil time today
      const scheduledFor = new Date(nowBrazil);
      scheduledFor.setHours(9, 0, 0, 0);

      const { error: insertError } = await supabase.from("automation_queue").insert({
        tenant_id: customer.tenant_id,
        automation_id: bdayTemplate.id,
        customer_id: customer.id,
        workflow_key: "customer_birthday",
        event_name: "customer.birthday",
        status: "pending",
        scheduled_for: scheduledFor.toISOString(),
        reference_year: year,
        payload: { 
          year: year,
          customer_name: customer.name,
          birth_date: customer.birth_date
        }
      });
      
      if (insertError) {
        if (insertError.code === '23505') {
          console.log(`[AutomationEngine] Birthday duplicate prevented by DB for ${customer.name} (${year})`);
        } else {
          console.error(`[AutomationEngine] Insert error for ${customer.name}:`, insertError);
        }
      } else {
        console.log(`[AutomationEngine] Queued birthday for ${customer.name} (Tenant: ${customer.tenant_id}, Year: ${year})`);
      }
    } catch (e: any) {
      console.error(`[AutomationEngine] Unexpected error processing customer ${customer.id}:`, e.message);
    }
  }
}
