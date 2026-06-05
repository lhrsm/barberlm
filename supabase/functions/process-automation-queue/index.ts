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
      if (tenant_id) query = query.eq("tenant_id", tenant_id);
      if (appointment_id) query = query.eq("appointment_id", appointment_id);
    }

    const { data: queueItems, error: queueError } = await query.limit(10);

    if (queueError) throw queueError;
    
    let itemsToProcess = queueItems || [];

    // 2. If no queue items found but it's a forced resend with appointment_id, create a virtual item
    if (itemsToProcess.length === 0 && force_resend && appointment_id) {
      console.log("[ProcessQueue] No queue item found for forced resend, attempting virtual item creation");
      
      // Fetch appointment
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

      // Fetch automation
      let automationQuery = supabase.from("automation_templates").select("*");
      if (automation_id) {
        automationQuery = automationQuery.eq("id", automation_id);
      } else if (workflow_key) {
        automationQuery = automationQuery.eq("key", workflow_key).eq("tenant_id", tenant_id || appointment.tenant_id);
      } else {
        // Default to appointment confirmation
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
          const { data: activeConv } = await supabase
            .from("automation_conversations")
            .select("id")
            .eq("appointment_id", appointment.id)
            .eq("status", "active")
            .maybeSingle();

          if (activeConv) {
            console.log(`[ProcessQueue] Skipping item ${item.id} - Active conversation already exists for appointment ${appointment.id}`);
            await supabase.from("automation_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", item.id);
            results.push({ id: item.id, success: true, skipped: true, reason: "active_conversation_exists" });
            continue;
          }

          await supabase.from("automation_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", item.id);
          results.push({ id: item.id, success: true, skipped: true, reason: "confirmation_already_sent" });
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

        // 3. Resolve Professional
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

        // 4. Build Message
        const buildAppointmentConfirmationMessage = (data: any) => {
          return `Olá ${data.customer_name} 👋\n\nSeu agendamento na ${data.barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: ${data.service_name}\n💈 Profissional: ${data.professional_name}\n📅 Data: ${data.appointment_date}\n⏰ Horário: ${data.appointment_time}\n\nO que deseja fazer?`;
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
          // Ativando botões reais para o Z-API
          sendOptions.buttons = [
            { id: "main_confirm", label: "Confirmar agendamento" },
            { id: "main_reschedule", label: "Reagendar" },
            { id: "main_cancel", label: "Cancelar" }
          ];
          renderedTemplate = buildAppointmentConfirmationMessage(testData);
        } else {
          renderedTemplate = automation.template;
          Object.entries(testData).forEach(([key, value]) => {
            renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value as string);
          });
        }

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

        // 7. Send Message
        const sendResult = await sendMessage(instance, phone, renderedTemplate, sendOptions);
        const finalMessageType = (sendOptions.buttons && sendResult.response?.buttonList) ? 'buttons' : 'text_fallback';

        if (sendResult.success) {
          const providerMessageId = sendResult.response?.messageId || sendResult.response?.id;
          
          // REGISTRO DE SESSÃO DE CONVERSA (PRIMEIRO PARA VINCULAR)
          let conversationId = null;
          let conversationCreated = false;
          let conversationError = null;

          if (automation.key === 'appointment_confirmation') {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 2);

            const { data: conversation, error: convError } = await supabase.from("automation_conversations").insert({
              tenant_id: itemTenantId,
              appointment_id: appointment.id,
              customer_phone: phone,
              phone: phone,
              phone_normalized: phone,
              automation_type: 'appointment_confirmation',
              workflow_key: 'appointment_confirmation',
              status: "active",
              current_state: "AWAITING_MAIN_ACTION",
              expected_response: "confirmation_menu",
              expires_at: expiresAt.toISOString(),
            }).select().single();

            if (convError) {
              console.error(`[ProcessQueue] Error creating conversation session:`, convError);
              conversationError = convError.message;
            } else {
              conversationId = conversation.id;
              conversationCreated = true;
            }
          }

          // REGISTRO NO HISTÓRICO DE ENVIO (V2)
          const { error: dispatchError } = await supabase.from("automation_v2_dispatches").insert({
            tenant_id: itemTenantId,
            appointment_id: appointment.id,
            workflow_key: automation.key,
            flow_type: 'single', // Padronizado conforme solicitado
            phone: phone,
            customer_name: appointment.customer?.name,
            status: "sent",
            message_id: providerMessageId,
            sent_at: new Date().toISOString(),
            payload: { 
              data: testData, 
              diagnostic: diagInfo, 
              rendered_message: renderedTemplate,
            },
            provider_response: sendResult.response,
            session_id: conversationId,
            current_step: "AWAITING_MAIN_ACTION"
          });

          if (dispatchError) {
            console.error(`[ProcessQueue] Error creating dispatch record:`, dispatchError);
          }

          // Mantendo compatibilidade com tabelas legadas se necessário, 
          // mas o foco agora é a v2_dispatches
          await supabase.from("automation_send_history").insert({
            tenant_id: itemTenantId,
            appointment_id: appointment.id,
            automation_name: automation.name,
            event_name: automation.trigger_event,
            source: force_resend ? 'test_manual' : 'automatic',
            channel: 'whatsapp',
            phone: phone,
            status: "sent",
            provider_message_id: providerMessageId,
            conversation_created: conversationCreated,
            conversation_id: conversationId,
            conversation_error: conversationError,
            payload: { 
              data: testData, 
              diagnostic: diagInfo, 
              buttons_attached: !!sendOptions.buttons,
              rendered_message: renderedTemplate,
              session_info: {
                conversation_created,
                conversation_id: conversationId,
                error: conversationError
              }
            },
            zapi_response: sendResult.response
          });

          await supabase.from("automation_queue").update({ status: "success", attempts: (item.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq("id", item.id);
          
          // Logs de auditoria (automation_logs)
          await supabase.from("automation_logs").insert({
            automation_id: automation.id,
            tenant_id: itemTenantId,
            appointment_id: appointment.id,
            customer_id: appointment.customer_id,
            phone: phone,
            status: "aguardando_resposta",
            action: "mensagem_enviada",
            message_type: finalMessageType,
            processed_template: renderedTemplate,
            provider_message_id: providerMessageId,
            conversation_id: conversationId,
            payload: { 
              rendered_message: renderedTemplate,
              conversation_created,
              conversation_id: conversationId
            }
          });

          await supabase.from("appointments").update({ confirmation_sent: true, confirmation_sent_at: new Date().toISOString() }).eq("id", appointment.id);
          results.push({ id: item.id, success: true });

        } else {
          throw new Error(sendResult.error || "Z-API failed");
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