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
          service:services(name, price)
        ),
        customer:customers(name, phone)
      `);

    if (force_resend && appointment_id) {
      query = query.eq("appointment_id", appointment_id);
    } else {
      query = query.or("status.eq.pending,status.eq.failed");
      query = query.lt("attempts", 5); // Aumentado para 5 para suportar mais retentativas
      
      const now = new Date().toISOString();
      // Filtra por agendado para agora ou no passado E (próxima retentativa é nula ou no passado)
      query = query.and(`scheduled_for.is.null,scheduled_for.lte.${now}`);
      query = query.or(`next_retry_at.is.null,next_retry_at.lte.${now}`);
      
      if (tenant_id) query = query.eq("tenant_id", tenant_id);
      if (appointment_id) query = query.eq("appointment_id", appointment_id);
    }

    const { data: queueItems, error: queueError } = await query.order('created_at', { ascending: true }).limit(20);

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
        const { appointment, automation, tenant_id: itemTenantId } = item;
        
        const isBirthday = automation?.key === 'customer_birthday';
        const isAnniversary = automation?.key === 'barbershop_anniversary';
        if (!automation || (!appointment && !isBirthday && !isAnniversary)) throw new Error("Data incomplete");

        if (!force_resend && appointment?.confirmation_sent) {
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

        const profId = appointment?.barber_id || appointment?.professional_id;
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
          customer_name: appointment?.customer?.name || item.payload?.customer_name || "Cliente",
          barbershop_name: barbershopName,
          service_name: appointment?.service?.name || "Serviço",
          professional_name: profName,
          appointment_date: appointment?.start_time ? formatBrazilDate(appointment.start_time) : "",
          appointment_time: appointment?.start_time ? formatBrazilTime(appointment.start_time) : "",
          service_price: appointment ? `R$ ${appointment.total_price || appointment.service?.price || 0}` : "R$ 0",
          birth_date: item.payload?.birth_date || "",
        };

        const sendOptions: any = {};
        let renderedTemplate = "";

        if (automation.key === 'appointment_confirmation') {
          // Rule: No buttons on initial confirmation. Direct confirmation flow with management link.
          const managementUrl = `https://barberlm.lovable.app/agendamento/${appointment?.management_token || ''}?tenant=${itemTenantId}`;
          renderedTemplate = `Olá ${testData.customer_name} 👋\n\nSeu agendamento na ${testData.barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: ${testData.service_name}\n💈 Profissional: ${testData.professional_name}\n📅 Data: ${testData.appointment_date}\n⏰ Horário: ${testData.appointment_time}\n\n🔗 Gerencie seu agendamento aqui:\n${managementUrl}\n\nObrigado!`;
        } else if (automation.key === 'cancellation') {
          const managementUrl = `https://barberlm.lovable.app/agendamento/${appointment?.management_token || ''}?tenant=${itemTenantId}`;
          renderedTemplate = `Olá ${testData.customer_name} 👋\n\nInformamos que seu agendamento na ${testData.barbershop_name} para o dia ${testData.appointment_date} às ${testData.appointment_time} foi CANCELADO.\n\n🔗 Você pode visualizar os detalhes aqui:\n${managementUrl}\n\nEsperamos te ver em breve! 💈`;
        } else if (automation.key === 'appointment_reminder') {
          const type = item.payload?.reminder_type || "6h";
          
          // DEPRECATED: Interactive buttons removed in favor of link-based management.
          
          if (type === "6h") {
            renderedTemplate = `Olá ${testData.customer_name} 👋\n\nPassando para lembrar do seu agendamento na ${testData.barbershop_name}.\n\n📋 Serviço: ${testData.service_name}\n💈 Profissional: ${testData.professional_name}\n📅 Data: ${testData.appointment_date}\n⏰ Horário: ${testData.appointment_time}\n\nEstamos te esperando!`;
          } else if (type === "1h") {
            renderedTemplate = `Olá ${testData.customer_name} 👋\n\nSeu atendimento na ${testData.barbershop_name} está chegando.\n\n⏰ Falta apenas 1 hora para o seu agendamento.\n\n📋 Serviço: ${testData.service_name}\n💈 Profissional: ${testData.professional_name}\n⏰ Horário: ${testData.appointment_time}`;
          } else if (type === "30m") {
            renderedTemplate = `Olá ${testData.customer_name} 👋\n\nFaltam 30 minutos para o seu agendamento na ${testData.barbershop_name}.\n\n📋 Serviço: ${testData.service_name}\n💈 Profissional: ${testData.professional_name}\n⏰ Horário: ${testData.appointment_time}`;
          }
        } else if (automation.key === 'customer_birthday') {
           renderedTemplate = `Olá ${testData.customer_name} 🎉\n\nA ${testData.barbershop_name} te felicita pelo seu aniversário!\n\nQue seu dia seja especial e cheio de boas comemorações. 🥳\n\nE para comemorar com a gente, você ganhou um cupom especial para usar em nossos produtos ou serviços na barbearia.\n\n🎁 Cupom: ANIVERSARIO10\n\nEsperamos você para celebrar esse momento com estilo! 💈`;
        } else if (automation.key === 'barbershop_anniversary') {
           const type = item.payload?.anniversary_message_type || "anniversary_day";
           if (type === "reminder_7_days") {
              renderedTemplate = automation.additional_templates?.reminder_7_days || `Olá ${testData.customer_name} 👋\n\nO aniversário da ${testData.barbershop_name} está chegando! 🎉\n\nFaltam apenas 7 dias para celebrarmos mais um ano dessa história com você.\n\nPrepare-se, porque vem comemoração especial por aí! 💈`;
              Object.entries(testData).forEach(([key, value]) => {
                renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value as string);
              });
           } else {
              renderedTemplate = automation.template;
              Object.entries(testData).forEach(([key, value]) => {
                renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value as string);
              });
           }
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

        const phone = appointment?.customer?.phone || item.customer?.phone;
        if (!phone) throw new Error("Phone missing");

        const sendResult = await sendAutomationMessageV2(supabase, {
          tenant_id: itemTenantId,
          workflow_key: automation.key,
          appointment_id: appointment?.id,
          appointment_group_id: appointment?.group_id || appointment?.appointment_group_id,
          customer_id: appointment?.customer_id || item.customer_id,
          customer_phone: phone,
          customer_name: testData.customer_name,
          message: renderedTemplate,
          buttons: sendOptions.buttons,
          payload: { 
            ...testData, 
            diagnostic: diagInfo, 
            reference_year: item.reference_year,
            anniversary_year: item.payload?.anniversary_year,
            anniversary_message_type: item.payload?.anniversary_message_type,
            reminder_type: item.payload?.reminder_type,
            test_mode: force_resend ? true : false
          },
          instance: instance
        });

        if (sendResult.success) {
          if (sendResult.warning === "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED") {
             throw new Error("WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED");
          }

          const now = new Date().toISOString();
          await supabase.from("automation_queue").update({ 
            status: "success", 
            attempts: (item.attempts || 0) + 1, 
            retry_count: (item.retry_count || 0) + 1,
            last_retry_at: now,
            updated_at: now 
          }).eq("id", item.id);

          // Registrar log de sucesso
          await supabase.from("whatsapp_delivery_logs").insert({
            tenant_id: itemTenantId,
            queue_id: item.id,
            appointment_id: appointment?.id,
            status: 'success',
            attempt_number: (item.attempts || 0) + 1,
            provider_response: sendResult.response,
            sent_at: now
          });

          if (appointment?.id) {
            await supabase.from("appointments").update({ 
              confirmation_sent: true, 
              confirmation_sent_at: now 
            }).eq("id", appointment.id);
          }

          results.push({ id: item.id, success: true });
        } else {
          throw new Error(sendResult.error || "Failed to send automation message");
        }
      } catch (err: any) {
        console.error(`[ProcessQueue] Fail:`, err.message);
        const now = new Date().toISOString();
        const nextAttempts = (item.attempts || 0) + 1;
        
        // Calcular próximo horário de retentativa com backoff exponencial e jitter
        let delayMinutes = 5;
        if (nextAttempts === 2) delayMinutes = 15;
        else if (nextAttempts === 3) delayMinutes = 60;
        else if (nextAttempts === 4) delayMinutes = 240;
        else if (nextAttempts >= 5) delayMinutes = 1440;

        // Adicionar jitter (variância de 10%)
        const jitter = Math.floor(Math.random() * (delayMinutes * 0.1 * 60)); // jitter em segundos
        const nextRetryAt = new Date(Date.now() + (delayMinutes * 60 * 1000) + (jitter * 1000)).toISOString();

        await supabase.from("automation_queue").update({ 
          status: nextAttempts >= 5 ? "failed" : "pending", 
          error_message: err.message, 
          attempts: nextAttempts,
          retry_count: (item.retry_count || 0) + 1,
          last_retry_at: now,
          next_retry_at: nextRetryAt,
          updated_at: now 
        }).eq("id", item.id);

        // Registrar log de falha
        await supabase.from("whatsapp_delivery_logs").insert({
          tenant_id: itemTenantId,
          queue_id: item.id,
          appointment_id: appointment?.id,
          status: 'failed',
          error_message: err.message,
          attempt_number: nextAttempts,
          sent_at: now
        });

        results.push({ id: item.id, success: false, error: err.message, next_retry_at: nextRetryAt });
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
