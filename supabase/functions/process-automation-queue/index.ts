import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";
import { sendAutomationMessageV2 } from "../_shared/automation-v2-engine.ts";
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
    const { tenant_id, appointment_id, automation_id, workflow_key, force_resend, dry_run } = await req.json().catch(() => ({}));
    
    console.log("[ProcessQueue] Unified Start", { tenant_id, appointment_id, automation_id, workflow_key, force_resend, dry_run });

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
      
      const now = new Date().toISOString();
      query = query.or(`scheduled_for.is.null,scheduled_for.lte.${now}`);
      
      if (tenant_id) query = query.eq("tenant_id", tenant_id);
      if (appointment_id) query = query.eq("appointment_id", appointment_id);
    }

    const { data: queueItems, error: queueError } = await query.limit(10);

    if (queueError) throw queueError;
    
    let itemsToProcess = queueItems || [];

    // 2. If no queue items found but it's a forced resend with appointment_id, create a virtual item
    if (itemsToProcess.length === 0 && force_resend && appointment_id) {
      console.log("[ProcessQueue] No queue item found for forced resend, attempting virtual item creation");
      
      const { data: appointment, error: appError } = await supabase
        .from("appointments")
        .select(`
          *,
          customer:customers(name, phone),
          service:services(name, price)
        `)
        .eq("id", appointment_id)
        .single();
      
      if (appError || !appointment) {
        throw new Error("Appointment not found for virtual resend");
      }

      let automationQuery = supabase.from("automation_templates").select("*");
      if (automation_id) {
        automationQuery = automationQuery.eq("id", automation_id);
      } else if (workflow_key) {
        automationQuery = automationQuery.eq("key", workflow_key).eq("tenant_id", tenant_id || appointment.tenant_id);
      } else {
        automationQuery = automationQuery.eq("key", "appointment_confirmation").eq("tenant_id", tenant_id || appointment.tenant_id);
      }

      const { data: automation, error: autoError } = await automationQuery.single();

      if (autoError || !automation) {
        throw new Error("Automation template not found for virtual resend");
      }

      itemsToProcess = [{
        id: "virtual-" + crypto.randomUUID(),
        tenant_id: tenant_id || appointment.tenant_id,
        appointment_id: appointment.id,
        automation_id: automation.id,
        status: "pending",
        attempts: 0,
        appointment,
        automation
      }];
    }

    if (itemsToProcess.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No items to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const item of itemsToProcess) {
      try {
        const { appointment, automation, tenant_id: itemTenantId } = item;
        
        if (!appointment || !automation) throw new Error("Data incomplete");

        if (!force_resend && appointment.confirmation_sent) {
          const { data: activeSess } = await supabase
            .from("automation_v2_sessions")
            .select("id")
            .eq("appointment_id", appointment.id)
            .eq("status", "active")
            .maybeSingle();

          if (activeSess) {
            console.log(`[ProcessQueue] Skipping item ${item.id} - Active session already exists for appointment ${appointment.id}`);
            await supabase.from("automation_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", item.id);
            results.push({ id: item.id, success: true, skipped: true, reason: "active_session_exists" });
            continue;
          }

          await supabase.from("automation_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", item.id);
          results.push({ id: item.id, success: true, skipped: true, reason: "confirmation_already_sent" });
          continue;
        }

        let barbershopName = "Barbearia";
        const { data: tenantData } = await supabase.from("tenants").select("name").eq("id", itemTenantId).maybeSingle();
        if (tenantData?.name && !['Barbearia', 'Barbershop'].includes(tenantData.name)) barbershopName = tenantData.name;
        else {
          const { data: profileData } = await supabase.from("profiles").select("business_name").eq("id", itemTenantId).maybeSingle();
          if (profileData?.business_name) barbershopName = profileData.business_name;
        }

        const profId = appointment.barber_id || appointment.professional_id;
        let profName = "Profissional";
        let resolvedTable = "none";

        if (profId) {
            const { data: barbData } = await supabase.from("barbers").select("name").eq("id", profId).maybeSingle();
            if (barbData?.name) { profName = barbData.name; resolvedTable = "barbers"; }
            else {
              const { data: pData } = await supabase.from("profiles").select("full_name").eq("id", profId).maybeSingle();
              if (pData?.full_name) { profName = pData.full_name; resolvedTable = "profiles"; }
            }
        }

        const diagInfo = { 
          resolved_table: resolvedTable, 
          prof_id_used: profId,
          prof_name_found: profName !== "Profissional",
          origin: force_resend ? 'test_manual' : 'automatic'
        };

        const testData = {
          customer_name: appointment.customer?.name || "Cliente",
          barbershop_name: barbershopName,
          service_name: appointment.service?.name || "Serviço",
          professional_name: profName,
          appointment_date: formatBrazilDate(appointment.start_time),
          appointment_time: formatBrazilTime(appointment.start_time),
          service_price: `R$ ${appointment.total_price || appointment.service?.price || 0}`,
        };

        const sendOptions: any = {};
        let renderedTemplate = "";

        if (automation.key === 'appointment_confirmation') {
          sendOptions.buttons = [
            { id: "main_confirm", label: "Confirmar agendamento" },
            { id: "main_reschedule", label: "Reagendar" },
            { id: "main_cancel", label: "Cancelar" }
          ];
          renderedTemplate = `Olá ${testData.customer_name} 👋\n\nSeu agendamento na ${testData.barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: ${testData.service_name}\n💈 Profissional: ${testData.professional_name}\n📅 Data: ${testData.appointment_date}\n⏰ Horário: ${testData.appointment_time}\n\nO que deseja fazer?`;
        } else {
          renderedTemplate = automation.template;
          Object.entries(testData).forEach(([key, value]) => {
            renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value as string);
          });
        }

        if (dry_run) {
          results.push({ id: item.id, success: true, dry_run: true, payload: { phone: appointment.customer?.phone, message: renderedTemplate, buttons: sendOptions.buttons, testData, diagnostic: diagInfo } });
          continue;
        }

        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", itemTenantId).single();
        if (!instance) throw new Error("WhatsApp not configured");

        const phone = appointment.customer?.phone;
        if (!phone) throw new Error("Phone missing");

        const sendResult = await sendAutomationMessageV2(supabase, {
          tenant_id: itemTenantId,
          workflow_key: automation.key,
          appointment_id: appointment.id,
          appointment_group_id: appointment.group_id || appointment.appointment_group_id,
          customer_id: appointment.customer_id,
          customer_phone: phone,
          customer_name: appointment.customer?.name,
          message: renderedTemplate,
          buttons: sendOptions.buttons,
          payload: { data: testData, diagnostic: diagInfo },
          instance: instance
        });

        if (sendResult.success) {
          if (sendResult.warning === "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED") {
             throw new Error("WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED");
          }

          await supabase.from("automation_queue").update({ 
            status: "success", 
            attempts: (item.attempts || 0) + 1, 
            updated_at: new Date().toISOString() 
          }).eq("id", item.id);

          await supabase.from("appointments").update({ 
            confirmation_sent: true, 
            confirmation_sent_at: new Date().toISOString() 
          }).eq("id", appointment.id);

          results.push({ id: item.id, success: true });
        } else {
          throw new Error(sendResult.error || "Failed to send automation message");
        }
      } catch (err: any) {
        console.error(`[ProcessQueue] Fail:`, err.message);
        await supabase.from("automation_queue").update({ status: "failed", error_message: err.message, attempts: (item.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq("id", item.id);
        results.push({ id: item.id, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[ProcessQueue] Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});