import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";
import { sendAutomationMessageV2 } from "../_shared/automation-v2-engine.ts";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";
import { processAutomationTemplate } from "../_shared/template-parser.ts";

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
    const { tenant_id, appointment_id, automation_id, workflow_key, force_resend, dry_run, payload: requestPayload } = await req.json().catch(() => ({}));
    
    console.log("[ProcessQueue] Unified Start", { tenant_id, appointment_id, automation_id, workflow_key, force_resend, dry_run, requestPayload });

    // 1. Fetch items to process
    let query = supabase
      .from("automation_queue")
      .select(`
        *,
        automation:automation_templates(*),
        appointment:appointments(
          *,
          customer:customers(name, phone),
          service:services(name, price),
          barber:barbers(name)
        ),
        customer:customers(name, phone)
      `);

    if (force_resend && appointment_id) {
      query = query.eq("appointment_id", appointment_id);
    } else {
      query = query.or("status.eq.pending,status.eq.failed");
      query = query.filter("attempts", "lt", 5); 
      
      const now = new Date().toISOString();
      query = query.or(`scheduled_for.is.null,scheduled_for.lte.${now}`);
      
      if (tenant_id) query = query.eq("tenant_id", tenant_id);
      if (appointment_id) query = query.eq("appointment_id", appointment_id);
    }

    const { data: queueItems, error: queueError } = await query.order('created_at', { ascending: true }).limit(20);

    if (queueError) throw queueError;
    
    let itemsToProcess = queueItems || [];

    // 2. Virtual item creation for forced resend
    if (itemsToProcess.length === 0 && force_resend && appointment_id) {
      console.log("[ProcessQueue] No queue item found for forced resend, attempting virtual item creation");
      
      const { data: appointment, error: appError } = await supabase
        .from("appointments")
        .select(`
          *,
          customer:customers(name, phone),
          service:services(name, price),
          barber:barbers(name)
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

      const { data: automation, error: autoError } = await automationQuery.maybeSingle();

      itemsToProcess = [{
        id: "virtual-" + crypto.randomUUID(),
        tenant_id: tenant_id || appointment.tenant_id,
        appointment_id: appointment.id,
        automation_id: automation?.id,
        status: "pending",
        attempts: 0,
        appointment,
        automation,
        payload: requestPayload || {}
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
        console.log(`[ProcessQueue] Processing item ${item.id}`);
        const { appointment, automation, tenant_id: itemTenantId, workflow_key, automation_type, id: queueId } = item;
        
        const currentWorkflowKey = workflow_key || automation?.key || automation_type || 'new_appointment';
        const isBirthday = currentWorkflowKey === 'customer_birthday';
        const isAnniversary = currentWorkflowKey === 'barbershop_anniversary';
        const isNewAppointment = currentWorkflowKey === 'appointment_confirmation' || currentWorkflowKey === 'new_appointment';

        if (!appointment && !isBirthday && !isAnniversary) {
          throw new Error("Data incomplete: appointment missing");
        }

        // Deduplication check
        if (!force_resend && appointment?.id) {
          const { data: alreadySent } = await supabase
            .from("automation_logs")
            .select("id")
            .eq("appointment_id", appointment.id)
            .eq("automation_id", automation?.id || item.automation_id)
            .eq("status", "sent")
            .maybeSingle();

          if (alreadySent) {
            console.log(`[ProcessQueue] Already sent for appointment ${appointment.id}`);
            await supabase.from("automation_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", queueId);
            results.push({ id: queueId, success: true, skipped: true, reason: "already_sent" });
            continue;
          }
        }

        // Data Loading
        let barbershopName = "Barbearia";
        const { data: tenantData } = await supabase.from("tenants").select("name").eq("id", itemTenantId).maybeSingle();
        if (tenantData?.name && !['Barbearia', 'Barbershop'].includes(tenantData.name)) {
          barbershopName = tenantData.name;
        } else {
          const { data: profileData } = await supabase.from("profiles").select("business_name, full_name").eq("id", itemTenantId).maybeSingle();
          barbershopName = profileData?.business_name || profileData?.full_name || "Barbearia";
        }

        const profId = appointment?.barber_id || appointment?.professional_id;
        let profName = appointment?.barber?.name || "Profissional";
        if (!appointment?.barber?.name && profId) {
          const { data: barbData } = await supabase.from("barbers").select("name").eq("id", profId).maybeSingle();
          if (barbData?.name) { 
            profName = barbData.name; 
          } else {
            const { data: pData } = await supabase.from("profiles").select("full_name").eq("id", profId).maybeSingle();
            if (pData?.full_name) profName = pData.full_name;
          }
        }

        const customerName = appointment?.customer?.name || item.payload?.customer_name || item.customer?.name || "Cliente";
        const appointmentDate = appointment?.start_time ? formatBrazilDate(appointment.start_time) : "";
        const appointmentTime = appointment?.start_time ? formatBrazilTime(appointment.start_time) : "";
        const serviceName = appointment?.service?.name || item.payload?.service_name || "Serviço";
        
        let managementUrl = "";
        if (appointment) {
          const groupToken = appointment.group_token || appointment.appointment_group_id || appointment.group_id;
          if (groupToken) {
            managementUrl = `https://barbex.shop/agendamentos/grupo/${groupToken}`;
          } else {
            const token = appointment.management_token || appointment.id;
            managementUrl = `https://barbex.shop/agendamento/${token}`;
          }
        }

        const templateData = {
          customer_name: customerName,
          barbershop_name: barbershopName,
          service_name: serviceName,
          professional_name: profName,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          management_link: managementUrl,
          management_token: appointment?.management_token || appointment?.id,
          service_price: appointment ? `R$ ${appointment.total_price || appointment.service?.price || 0}` : "R$ 0",
        };

        console.log(`[ProcessQueue] Variables resolved for ${currentWorkflowKey}`, templateData);

        let baseTemplate = automation?.template || "";
        if (isNewAppointment && !baseTemplate) {
          baseTemplate = `Olá, {customer_name}! 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nPara reagendar ou cancelar, acesse o link abaixo:\n{management_link}\n\nObrigado!`;
        }

        let renderedMessage = processAutomationTemplate(baseTemplate, templateData);

        // Validation - Don't block everything, just this item
        const placeholders = ['{customer_name}', '{barbershop_name}', '{service_name}', '{professional_name}', '{appointment_date}', '{appointment_time}', '{management_link}'];
        const missing = placeholders.filter(p => renderedMessage.includes(p) || renderedMessage.includes(p.replace('{', '{{').replace('}', '}}')));

        if (missing.length > 0) {
          const errorMsg = `Template possui variáveis não substituídas: ${missing.join(', ')}`;
          console.error(`[ProcessQueue] Item ${item.id} failed: ${errorMsg}`);
          
          await supabase.from("automation_queue").update({ 
            status: "failed", 
            error_message: errorMsg,
            updated_at: new Date().toISOString()
          }).eq("id", queueId);

          await supabase.from("automation_logs").insert({
            tenant_id: itemTenantId,
            automation_id: automation?.id || item.automation_id,
            appointment_id: appointment?.id,
            status: 'failed',
            error_message: errorMsg,
            payload: { missing_variables: missing, template: baseTemplate, data: templateData }
          });

          results.push({ id: queueId, success: false, error: errorMsg });
          continue;
        }

        if (dry_run) {
          results.push({ id: queueId, success: true, dry_run: true, payload: { message: renderedMessage, templateData } });
          continue;
        }

        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", itemTenantId).maybeSingle();
        if (!instance) throw new Error("WhatsApp not configured (instance not found)");

        const phone = appointment?.customer?.phone || item.customer?.phone || item.payload?.phone;
        if (!phone) throw new Error("Customer phone missing");

        console.log(`[ProcessQueue] Sending message to ${phone}`);

        const sendResult = await sendAutomationMessageV2(supabase, {
          tenant_id: itemTenantId,
          workflow_key: currentWorkflowKey,
          appointment_id: appointment?.id,
          customer_id: appointment?.customer_id || item.customer_id,
          customer_phone: phone,
          customer_name: customerName,
          message: renderedMessage,
          payload: { ...templateData },
          instance: instance
        });

        if (sendResult.success) {
          const now = new Date().toISOString();
          await supabase.from("automation_queue").update({ 
            status: "success", 
            attempts: (item.attempts || 0) + 1, 
            processed_at: now,
            updated_at: now 
          }).eq("id", queueId);

          await supabase.from("automation_logs").insert({
            tenant_id: itemTenantId,
            automation_id: automation?.id || item.automation_id,
            appointment_id: appointment?.id,
            status: 'sent',
            payload: { message: renderedMessage, ...templateData }
          });

          if (appointment?.id) {
            await supabase.from("appointments").update({ 
              confirmation_sent: true, 
              confirmation_sent_at: now 
            }).eq("id", appointment.id);
          }

          results.push({ id: queueId, success: true });
          console.log(`[ProcessQueue] Item ${item.id} processed successfully`);
        } else {
          throw new Error(sendResult.error || "Failed to send automation message");
        }
      } catch (err: any) {
        console.error(`[ProcessQueue] Fail on item ${item.id}:`, err.message);
        const now = new Date().toISOString();
        const nextAttempts = (item.attempts || 0) + 1;
        
        await supabase.from("automation_queue").update({ 
          status: nextAttempts >= 5 ? "failed" : "pending", 
          error_message: err.message, 
          attempts: nextAttempts,
          updated_at: now 
        }).eq("id", item.id);

        await supabase.from("automation_logs").insert({
          tenant_id: item.tenant_id,
          automation_id: item.automation_id,
          appointment_id: item.appointment_id,
          status: 'failed',
          error_message: err.message,
          payload: { attempt: nextAttempts, error: err.message }
        });

        results.push({ id: item.id, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[ProcessQueue] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});