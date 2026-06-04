
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";

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
    const { tenant_id, appointment_id } = await req.json().catch(() => ({}));
    
    console.log("[ProcessQueue] Checking for pending automations...", { tenant_id, appointment_id });

    // 1. Fetch pending items from queue
    let query = supabase
      .from("automation_queue")
      .select(`
        *,
        automation:automation_templates(*),
        appointment:appointments(
          *,
          customer:customers(name, phone),
          service:services(name, price)
        )
      `)
      .eq("status", "pending");

    if (tenant_id) query = query.eq("tenant_id", tenant_id);
    if (appointment_id) query = query.eq("appointment_id", appointment_id);

    const { data: queueItems, error: queueError } = await query.limit(10);

    if (queueError) throw queueError;
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: "No pending items" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const item of queueItems) {
      try {
        const { appointment, automation, tenant_id: itemTenantId } = item;
        
        if (!appointment || !automation) {
          throw new Error("Missing appointment or automation data");
        }

        // 2. Render Template
        const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", itemTenantId).single();
        const { data: barber } = await supabase.from("profiles").select("full_name").eq("id", appointment.barber_id).maybeSingle();

        const testData = {
          customer_name: appointment.customer?.name || "Cliente",
          barbershop_name: profile?.business_name || "Nossa Barbearia",
          service_name: appointment.service?.name || "Serviço",
          professional_name: barber?.full_name || "Profissional",
          appointment_date: new Date(appointment.start_time).toLocaleDateString("pt-BR"),
          appointment_time: new Date(appointment.start_time).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }),
          service_price: `R$ ${appointment.total_price || appointment.service?.price || 0}`,
        };

        let renderedTemplate = automation.template;
        Object.entries(testData).forEach(([key, value]) => {
          renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value as string);
        });

        // 3. Get WhatsApp Instance
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("tenant_id", itemTenantId)
          .single();

        if (!instance) throw new Error("WhatsApp instance not configured for this tenant");

        // 4. Send Message
        const phone = appointment.customer?.phone;
        if (!phone) throw new Error("Customer phone not found");

        const sendResult = await sendMessage(instance, phone, renderedTemplate);

        // 5. Update Queue and Log
        if (sendResult.success) {
          await supabase.from("automation_queue").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", item.id);
          
          await supabase.from("automation_logs").insert({
            automation_id: automation.id,
            tenant_id: itemTenantId,
            appointment_id: appointment.id,
            phone: phone,
            status: "sent",
            message_type: automation.key,
            processed_template: renderedTemplate,
            original_template: automation.template,
            provider: "zapi",
            sent_at: new Date().toISOString(),
            payload: { data: testData, rendered: renderedTemplate, origin: 'automatic' },
            response: sendResult.response
          });
          
          // Mark appointment as confirmation sent
          await supabase.from("appointments").update({ 
            confirmation_sent: true, 
            confirmation_sent_at: new Date().toISOString() 
          }).eq("id", appointment.id);

        } else {
          throw new Error(sendResult.error || "Unknown error from Z-API");
        }

        results.push({ id: item.id, success: true });

      } catch (err: any) {
        console.error(`[ProcessQueue] Error processing item ${item.id}:`, err.message);
        await supabase.from("automation_queue").update({ 
          status: "error", 
          error_message: err.message,
          attempts: (item.attempts || 0) + 1,
          updated_at: new Date().toISOString() 
        }).eq("id", item.id);

        results.push({ id: item.id, success: false, error: err.message });
        
        // Log the failure
        await supabase.from("automation_logs").insert({
          automation_id: item.automation_id,
          tenant_id: item.tenant_id,
          appointment_id: item.appointment_id,
          status: "error",
          message_type: item.automation?.key,
          error_message: err.message,
          payload: { error: err.message, origin: 'automatic' }
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[ProcessQueue] Fatal error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
