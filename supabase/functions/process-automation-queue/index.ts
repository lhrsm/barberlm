
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";

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
    const { tenant_id, appointment_id, force_resend } = await req.json().catch(() => ({}));
    
    console.log("[ProcessQueue] Checking for pending automations...", { tenant_id, appointment_id, force_resend });

    // 1. Fetch items to process
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
      `);

    if (force_resend && appointment_id) {
      // If force resend, ignore status and attempts
      query = query.eq("appointment_id", appointment_id);
    } else {
      query = query.eq("status", "pending");
      if (tenant_id) query = query.eq("tenant_id", tenant_id);
      if (appointment_id) query = query.eq("appointment_id", appointment_id);
    }

    const { data: queueItems, error: queueError } = await query.limit(10);

    if (queueError) throw queueError;
    if (!queueItems || queueItems.length === 0) {
      // If no queue item found but we have appointment_id, maybe we should create one?
      // Actually, if it's a manual resend from logs, we might just want to trigger it.
      return new Response(JSON.stringify({ message: "No items to process", success: true }), {
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

        // Idempotency check: if not forcing resend, check if already sent
        if (!force_resend && appointment.confirmation_sent) {
          console.log(`[ProcessQueue] Skipping appointment ${appointment.id} - confirmation already sent`);
          await supabase.from("automation_queue").update({ 
            status: "skipped", 
            error_message: "Confirmation already sent",
            updated_at: new Date().toISOString() 
          }).eq("id", item.id);
          
          results.push({ id: item.id, success: true, skipped: true });
          continue;
        }

        // 2. Resolve Professional Name
        const professionalId = appointment.barber_id || appointment.professional_id;
        let profName = "Profissional";
        
        if (professionalId) {
          const { data: profData } = await supabase.from("profiles").select("full_name").eq("id", professionalId).maybeSingle();
          if (profData?.full_name && profData.full_name !== 'Profissional') {
            profName = profData.full_name;
          } else {
            // Check barbers table
            const { data: barberData } = await supabase.from("barbers").select("name").eq("id", professionalId).maybeSingle();
            if (barberData?.name) profName = barberData.name;
          }
        }

        // 3. Render Template with Brazil Timezone
        const { data: tenantProfile } = await supabase.from("profiles").select("business_name").eq("id", itemTenantId).maybeSingle();
        
        const testData = {
          customer_name: appointment.customer?.name || "Cliente",
          barbershop_name: tenantProfile?.business_name || "Nossa Barbearia",
          service_name: appointment.service?.name || "Serviço",
          professional_name: profName,
          appointment_date: formatBrazilDate(appointment.start_time),
          appointment_time: formatBrazilTime(appointment.start_time),
          service_price: `R$ ${appointment.total_price || appointment.service?.price || 0}`,
        };

        let renderedTemplate = automation.template;
        Object.entries(testData).forEach(([key, value]) => {
          renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value as string);
        });

        // 4. Get WhatsApp Instance
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("tenant_id", itemTenantId)
          .single();

        if (!instance) throw new Error("WhatsApp instance not configured for this tenant");

        const phone = appointment.customer?.phone;
        if (!phone) throw new Error("Customer phone not found");

        // 5. Send Message with buttons/fallback
        const sendOptions: any = {};
        if (automation.key === 'appointment_confirmation') {
          sendOptions.buttons = [
            { id: 'main_confirm', label: 'Confirmar agendamento' },
            { id: 'main_reschedule', label: 'Reagendar' },
            { id: 'main_cancel', label: 'Cancelar' }
          ];
        }

        const sendResult = await sendMessage(instance, phone, renderedTemplate, sendOptions);

        // 6. Update status and Log
        if (sendResult.success) {
          await supabase.from("automation_queue").update({ 
            status: "sent", 
            attempts: (item.attempts || 0) + 1,
            updated_at: new Date().toISOString() 
          }).eq("id", item.id);
          
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
            payload: { data: testData, rendered: renderedTemplate, origin: force_resend ? 'manual_resend' : 'automatic' },
            response: sendResult.response
          });
          
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
        
        await supabase.from("automation_logs").insert({
          automation_id: item.automation_id,
          tenant_id: item.tenant_id,
          appointment_id: item.appointment_id,
          phone: item.appointment?.customer?.phone || "N/A",
          status: "error",
          message_type: item.automation?.key,
          error_message: err.message,
          payload: { error: err.message, origin: force_resend ? 'manual_resend' : 'automatic' }
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
