
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
    const { tenant_id, appointment_id, force_resend, dry_run } = await req.json().catch(() => ({}));
    
    console.log("[ProcessQueue] Unified Start", { tenant_id, appointment_id, force_resend, dry_run });


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
      query = query.eq("appointment_id", appointment_id);
    } else {
      query = query.or("status.eq.pending,status.eq.failed");
      query = query.lt("attempts", 3);
      if (tenant_id) query = query.eq("tenant_id", tenant_id);
      if (appointment_id) query = query.eq("appointment_id", appointment_id);
    }

    const { data: queueItems, error: queueError } = await query.limit(10);

    if (queueError) throw queueError;
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No items to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const item of queueItems) {
      try {
        const { appointment, automation, tenant_id: itemTenantId } = item;
        
        if (!appointment || !automation) throw new Error("Data incomplete");

        if (!force_resend && appointment.confirmation_sent) {
          await supabase.from("automation_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", item.id);
          results.push({ id: item.id, success: true, skipped: true });
          continue;
        }

        // 2. Resolve Barbershop
        let barbershopName = "Barbearia";
        const { data: tenantData } = await supabase.from("tenants").select("name").eq("id", itemTenantId).maybeSingle();
        if (tenantData?.name && !['Barbearia', 'Barbershop'].includes(tenantData.name)) barbershopName = tenantData.name;
        else {
          const { data: profileData } = await supabase.from("profiles").select("business_name").eq("id", itemTenantId).maybeSingle();
          if (profileData?.business_name) barbershopName = profileData.business_name;
        }

        // 3. Resolve Professional (Manual Step-by-Step for robustness)
        const profId = appointment.barber_id || appointment.professional_id;
        let profName = "Profissional";
        let resolvedTable = "none";


        if (profId) {
            // Try barbers table
            const { data: barbData } = await supabase.from("barbers").select("name").eq("id", profId).maybeSingle();
            if (barbData?.name) { profName = barbData.name; resolvedTable = "barbers"; }
            else {
              const { data: pData } = await supabase.from("profiles").select("full_name").eq("id", profId).maybeSingle();
              if (pData?.full_name) { profName = pData.full_name; resolvedTable = "profiles"; }
            }
        }

        // 4. Build Test Data
        const testData = {
          customer_name: appointment.customer?.name || "Cliente",
          barbershop_name: barbershopName,
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

        const diagInfo = { 
          resolved_table: resolvedTable, 
          prof_id_used: profId,
          prof_name_found: profName !== "Profissional",
          origin: force_resend ? 'test_manual' : 'automatic'
        };

        const sendOptions: any = {};
        if (automation.key === 'appointment_confirmation') {
          sendOptions.buttons = [
            { id: 'main_confirm', label: 'Confirmar agendamento' },
            { id: 'main_reschedule', label: 'Reagendar' },
            { id: 'main_cancel', label: 'Cancelar' }
          ];
        }

        // 5. Dry Run exit

        if (dry_run) {
          results.push({ 
            id: item.id, 
            success: true, 
            dry_run: true,
            payload: {
              phone: appointment.customer?.phone,
              message: renderedTemplate,
              buttons: sendOptions.buttons,
              testData,
              diagnostic: diagInfo
            }
          });
          continue;
        }

        // 6. WhatsApp Instance
        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", itemTenantId).single();
        if (!instance) throw new Error("WhatsApp not configured");

        const phone = appointment.customer?.phone;
        if (!phone) throw new Error("Phone missing");

        // 7. Buttons
        const sendResult = await sendMessage(instance, phone, renderedTemplate, sendOptions);
        const finalMessageType = (sendOptions.buttons && sendResult.response?.buttonList) ? 'buttons' : 'text_fallback';


        // 7. Update status and Log
        if (sendResult.success) {
          await supabase.from("automation_queue").update({ status: "success", attempts: (item.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq("id", item.id);
          
          const providerMessageId = sendResult.response?.messageId || sendResult.response?.id;
          const zaapId = sendResult.response?.zaapId;

          if (!providerMessageId) {
             console.error(`[ProcessQueue] CRITICAL: Z-API returned success but no messageId for item ${item.id}`, sendResult.response);
             // Still record log but mark with error about missing ID
             await supabase.from("automation_logs").insert({
               automation_id: automation.id,
               tenant_id: itemTenantId,
               appointment_id: appointment.id,
               status: "error",
               error_message: "Z-API success without messageId/provider_message_id",
               payload: { response: sendResult.response, diagnostic: diagInfo, origin: 'provider_no_id' }
             });
             results.push({ id: item.id, success: false, error: "Missing providerMessageId" });
             continue;
          }

          // REGISTRO IMEDIATO DO ENVIO
          await supabase.from("automation_logs").insert({
            automation_id: automation.id,
            tenant_id: itemTenantId,
            appointment_id: appointment.id,
            customer_id: appointment.customer_id,
            phone: phone,
            status: "success",
            message_type: finalMessageType,
            processed_template: renderedTemplate,
            original_template: automation.template,
            provider: "zapi",
            sent_at: new Date().toISOString(),
            provider_message_id: providerMessageId,
            payload: { 
              data: testData, 
              diagnostic: diagInfo, 
              buttons_attached: !!sendOptions.buttons,
              source: force_resend ? 'test_manual' : 'automatic',
              zaap_id: zaapId
            },
            response: sendResult.response
          });
          
          await supabase.from("appointments").update({ confirmation_sent: true, confirmation_sent_at: new Date().toISOString() }).eq("id", appointment.id);
          results.push({ id: item.id, success: true });

        } else {
          throw new Error(sendResult.error || "Z-API failed");
        }

      } catch (err: any) {
        console.error(`[ProcessQueue] Fail:`, err.message);
        await supabase.from("automation_queue").update({ status: "failed", error_message: err.message, attempts: (item.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq("id", item.id);
        
        await supabase.from("automation_logs").insert({
          automation_id: item.automation_id,
          tenant_id: item.tenant_id,
          appointment_id: item.appointment_id,
          status: "failed",
          error_message: err.message,
          payload: { error: err.message, source: force_resend ? 'test_manual' : 'automatic' }
        });
        results.push({ id: item.id, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[ProcessQueue] Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message, details: error.stack }), {
      status: 200, // Return 200 so frontend can parse JSON and see error
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
