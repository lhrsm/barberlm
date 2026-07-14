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
    const { 
      tenant_id, 
      appointment_id, 
      appointment_group_id: requestGroupId,
      automation_id, 
      workflow_key, 
      force_resend, 
      dry_run, 
      payload: requestPayload 
    } = await req.json().catch(() => ({}));
    
    console.log("[ProcessQueue] Unified Start", { tenant_id, appointment_id, requestGroupId, automation_id, workflow_key, force_resend, dry_run, requestPayload });

    // 1. Fetch items to process
    let query = supabase
      .from("automation_queue")
      .select(`
        *,
        automation:automation_templates(*),
        appointment:appointments(
          *,
          appointment_group:appointment_groups(group_token),
          customer:customers(name, phone),
          service:services(name, price),
          barber:barbers!appointments_barber_id_fkey(name)
        ),
        customer:customers(name, phone)
      `);

    if (force_resend && (appointment_id || requestGroupId)) {
      if (requestGroupId) {
        query = query.eq("appointment_group_id", requestGroupId);
      } else {
        query = query.eq("appointment_id", appointment_id);
      }
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
    if (itemsToProcess.length === 0 && force_resend && (appointment_id || requestGroupId)) {
      console.log("[ProcessQueue] No queue item found for forced resend, attempting virtual item creation");
      
      let appointment = null;
      let appTenantId = tenant_id;

      if (appointment_id) {
        const { data: appData, error: appError } = await supabase
          .from("appointments")
          .select(`
            *,
            customer:customers(name, phone),
            service:services(name, price),
            barber:barbers!appointments_barber_id_fkey(name)
          `)
          .eq("id", appointment_id)
          .single();
        
        if (!appError && appData) {
          appointment = appData;
          appTenantId = appTenantId || appointment.tenant_id;
        }
      } else if (requestGroupId) {
        // Find one appointment from the group to use as base
        const { data: groupAppts } = await supabase
          .from("appointments")
          .select(`
            *,
            customer:customers(name, phone),
            service:services(name, price),
            barber:barbers!appointments_barber_id_fkey(name)
          `)
          .eq("appointment_group_id", requestGroupId)
          .limit(1);
        
        if (groupAppts && groupAppts.length > 0) {
          appointment = groupAppts[0];
          appTenantId = appTenantId || appointment.tenant_id;
        }
      }
      
      if (!appointment && !requestGroupId) {
        throw new Error("Appointment not found for virtual resend");
      }

      let automationQuery = supabase.from("automation_templates").select("*");
      if (automation_id) {
        automationQuery = automationQuery.eq("id", automation_id);
      } else if (workflow_key) {
        automationQuery = automationQuery.eq("key", workflow_key).eq("tenant_id", appTenantId);
      } else {
        automationQuery = automationQuery.eq("key", "appointment_confirmation").eq("tenant_id", appTenantId);
      }

      const { data: automation, error: autoError } = await automationQuery.maybeSingle();

      itemsToProcess = [{
        id: "virtual-" + crypto.randomUUID(),
        tenant_id: appTenantId,
        appointment_id: appointment?.id,
        appointment_group_id: requestGroupId,
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
        const { appointment, automation, tenant_id: itemTenantId, workflow_key, automation_type, id: queueId, appointment_group_id } = item;
        
        const currentWorkflowKey = workflow_key || automation?.key || automation_type || 'new_appointment';
        const isBirthday = currentWorkflowKey === 'customer_birthday';
        const isAnniversary = currentWorkflowKey === 'barbershop_anniversary';
        const isNewAppointment = currentWorkflowKey === 'appointment_confirmation' || currentWorkflowKey === 'new_appointment';

        if (!force_resend) {
          const replacementKey = currentWorkflowKey === 'post_service_review'
            ? 'appointment.completed.review.customer'
            : (currentWorkflowKey === 'appointment_confirmation' || currentWorkflowKey === 'new_appointment')
              ? 'appointment.created.customer'
              : null;

          if (replacementKey) {
            const { data: modernTemplate } = await supabase
              .from("automation_templates")
              .select("id")
              .eq("tenant_id", itemTenantId)
              .eq("key", replacementKey)
              .eq("active", true)
              .maybeSingle();

            if (modernTemplate) {
              console.log(`[ProcessQueue] Skipping legacy workflow ${currentWorkflowKey}; replaced by ${replacementKey}`);
              await supabase.from("automation_queue").update({
                status: "skipped",
                error_message: `legacy workflow replaced by ${replacementKey}`,
                updated_at: new Date().toISOString()
              }).eq("id", queueId);
              results.push({ id: queueId, success: true, skipped: true, reason: "legacy_replaced", replacement: replacementKey });
              continue;
            }
          }
        }

        if (!appointment && !isBirthday && !isAnniversary && !appointment_group_id) {
          throw new Error("Data incomplete: appointment or group missing");
        }

        // Deduplication check
        if (!force_resend) {
          const dupQuery = supabase
            .from("automation_logs")
            .select("id")
            .eq("automation_id", automation?.id || item.automation_id)
            .eq("status", "sent");
          
          if (appointment_group_id) {
            dupQuery.eq("appointment_group_id", appointment_group_id);
          } else if (appointment?.id) {
            dupQuery.eq("appointment_id", appointment.id);
          }

          const { data: alreadySent } = await dupQuery.maybeSingle();

          if (alreadySent) {
            console.log(`[ProcessQueue] Already sent for appointment ${appointment.id}`);
            await supabase.from("automation_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", queueId);
            results.push({ id: queueId, success: true, skipped: true, reason: "already_sent" });
            continue;
          }
        }

        // Data Loading — resolve barbershop name from tenant profile (business_name).
        let barbershopName = "Barbearia";
        const { data: profileData } = await supabase
          .from("profiles")
          .select("business_name, responsible_name")
          .eq("id", itemTenantId)
          .maybeSingle();
        if (profileData?.business_name && profileData.business_name.trim()) {
          barbershopName = profileData.business_name.trim();
        } else if (profileData?.responsible_name && profileData.responsible_name.trim()) {
          barbershopName = profileData.responsible_name.trim();
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
        let groupAppointments = [];
        
        if (appointment_group_id && isNewAppointment) {
          console.log(`[ProcessQueue] 👥 Group detected (${appointment_group_id}), loading group appointments`);
          const { data: gAppts, error: gError } = await supabase
            .from("appointments")
            .select(`
              start_time,
              service_amount,
              service:services(name),
              barber:barbers!appointments_barber_id_fkey(name)
            `)
            .eq("appointment_group_id", appointment_group_id)
            .order("group_sequence", { ascending: true });
          
          if (!gError && gAppts && gAppts.length > 0) {
            groupAppointments = gAppts;
            console.log(`[ProcessQueue] ✅ Loaded ${groupAppointments.length} group appointments`);
          } else {
            console.warn("[ProcessQueue] ⚠️ Failed to load group appointments", gError);
          }

          const { data: groupData } = await supabase
            .from("appointment_groups")
            .select("group_token")
            .eq("id", appointment_group_id)
            .maybeSingle();
          
          if (groupData?.group_token) {
            managementUrl = `https://barbex.shop/agendamentos/grupo/${groupData.group_token}?tenant=${itemTenantId}`;
          }
        } else if (appointment) {
          const groupToken = appointment.appointment_group?.group_token;
          if (groupToken) {
            managementUrl = `https://barbex.shop/agendamentos/grupo/${groupToken}?tenant=${itemTenantId}`;
          } else {
            const token = appointment.management_token || appointment.id;
            managementUrl = `https://barbex.shop/agendamento/${token}?tenant=${itemTenantId}`;
          }
        }

        const templateData = {
          customer_name: customerName,
          customer_phone: appointment?.customer?.phone || item.payload?.customer_phone || "",
          barbershop_name: barbershopName,
          service_name: serviceName,
          professional_name: profName,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          management_link: managementUrl,
          management_token: appointment?.management_token || appointment?.id,
          service_price: appointment ? `R$ ${appointment.total_price || appointment.service?.price || 0}` : "R$ 0",
          payment_method: item.payload?.payment_method || appointment?.payment_method || "",
          subscription_name: item.payload?.subscription_name || item.payload?.plan_name || "",
          plan_name: item.payload?.plan_name || item.payload?.subscription_name || "",
          cancel_reason: item.payload?.cancel_reason || "",
          old_date: item.payload?.old_date || "",
          old_time: item.payload?.old_time || "",
          new_date: item.payload?.new_date || appointmentDate,
          new_time: item.payload?.new_time || appointmentTime,
          cashback_amount: item.payload?.cashback_amount || "",
          credits_amount: item.payload?.credits_amount || "",
          reward_name: item.payload?.reward_name || "",
          review_link: item.payload?.review_link || "",
          review_token: item.payload?.review_token || "",
        };

        console.log(`[ProcessQueue] Variables resolved for ${currentWorkflowKey}`, templateData);

        let baseTemplate = automation?.template || "";
        if (isNewAppointment && !baseTemplate) {
          if (groupAppointments.length > 1) {
            console.log("[ProcessQueue] 🛠️ Building consolidated group message");
            let summary = "";
            let totalAmount = 0;
            
            groupAppointments.forEach((ga: any, index: number) => {
              const dateStr = formatBrazilDate(ga.start_time);
              const timeStr = formatBrazilTime(ga.start_time);
              const amount = Number(ga.service_amount) || 0;
              totalAmount += amount;
              
              summary += `${index + 1}. ${ga.service?.name || "Serviço"}\n`;
              summary += `💈 Profissional: ${ga.barber?.name || "Profissional"}\n`;
              summary += `📅 Data: ${dateStr}\n`;
              summary += `⏰ Horário: ${timeStr}\n`;
              summary += `💰 Valor: R$ ${amount.toFixed(2)}\n\n`;
            });

            baseTemplate = `Olá, {customer_name}! 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo dos agendamentos:\n\n${summary}Total: R$ ${totalAmount.toFixed(2)}\n\nPara reagendar ou cancelar, acesse:\n{management_link}\n\nObrigado!`;
            console.log("[ProcessQueue] ✅ group_message_built");
          } else {
            baseTemplate = `Olá, {customer_name}! 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nPara reagendar ou cancelar, acesse o link abaixo:\n{management_link}\n\nObrigado!`;
          }
        }

        let renderedMessage = processAutomationTemplate(baseTemplate, templateData);

        // Validation - only enforce placeholders on legacy appointment_confirmation flow.
        // New event templates handle their own placeholders per event type.
        const isLegacyAppointmentFlow = currentWorkflowKey === 'appointment_confirmation' || currentWorkflowKey === 'new_appointment';
        const placeholders = ['{customer_name}', '{barbershop_name}', '{service_name}', '{professional_name}', '{appointment_date}', '{appointment_time}', '{management_link}'];
        const missing = isLegacyAppointmentFlow ? placeholders.filter(p => renderedMessage.includes(p) || renderedMessage.includes(p.replace('{', '{{').replace('}', '}}'))) : [];

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

        // Recipient-aware phone resolution (event-driven automations set payload.recipient_phone)
        const recipient = automation?.recipient || item.payload?.recipient || 'customer';
        let phone: string | null = item.payload?.recipient_phone || null;
        if (!phone) {
          if (recipient === 'barber') {
            const barberId = appointment?.barber_id || appointment?.professional_id;
            if (barberId) {
              const { data: b } = await supabase.from('barbers').select('phone').eq('id', barberId).maybeSingle();
              phone = b?.phone || null;
            }
          } else if (recipient === 'shop') {
            const { data: p } = await supabase.from('profiles').select('whatsapp_number').eq('id', itemTenantId).maybeSingle();
            phone = p?.whatsapp_number || null;
          } else {
            phone = appointment?.customer?.phone || item.customer?.phone || item.payload?.phone || null;
          }
        }
        if (!phone) throw new Error(`Phone missing for recipient=${recipient}`);

        console.log(`[ProcessQueue] Sending to ${recipient} (${phone})`);

        // Fetch configured interactions (buttons) for this automation template
        let interactionButtons: any[] = [];
        if (automation?.id) {
          const { data: interactions } = await supabase
            .from("automation_interactions")
            .select("id, button_title, button_icon, action_type, active, display_order")
            .eq("automation_template_id", automation.id)
            .eq("active", true)
            .order("display_order", { ascending: true });

          if (interactions && interactions.length > 0) {
            interactionButtons = interactions.slice(0, 3).map((it: any) => {
              const rendered = processAutomationTemplate(it.button_title || "", templateData);
              const label = it.button_icon ? `${it.button_icon} ${rendered}` : rendered;
              return { id: it.id, label };
            });
            console.log(`[ProcessQueue] Attaching ${interactionButtons.length} interactive buttons`);
          }
        }

        const sendResult = await sendAutomationMessageV2(supabase, {
          tenant_id: itemTenantId,
          workflow_key: currentWorkflowKey,
          appointment_id: appointment?.id,
          customer_id: appointment?.customer_id || item.customer_id,
          customer_phone: phone,
          customer_name: customerName,
          message: renderedMessage,
          buttons: interactionButtons.length > 0 ? interactionButtons : undefined,
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
            appointment_group_id: appointment_group_id,
            status: 'sent',
            payload: { message: renderedMessage, ...templateData }
          });
          
          if (appointment_group_id) {
            console.log("[ProcessQueue] ✅ group_whatsapp_sent");
          }

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