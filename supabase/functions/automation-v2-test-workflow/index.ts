import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationTemplate } from "../_shared/template-parser.ts";
import { sendAutomationMessageV2 } from "../_shared/automation-v2-engine.ts";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";

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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json();
    const { 
      workflow_key, 
      event_name, 
      test_mode, 
      template_variant, 
      phone: testPhone, 
      tenant_id: requestedTenantId,
      appointment_id,
      simulate_only,
      dry_run,
      fictitious
    } = body;

    console.log("[TestWorkflow] Received request:", { workflow_key, event_name, test_mode, template_variant, appointment_id });

    if (!test_mode) {
      throw new Error("Esta função é exclusiva para testes.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = requestedTenantId || profile?.tenant_id || profile?.id;
    if (!tenantId) throw new Error("Tenant não encontrado");

    // 1. Fetch the specific template
    const { data: template, error: templateError } = await supabase
      .from("automation_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("key", workflow_key)
      .maybeSingle();

    if (templateError || !template) {
      throw new Error(`Template não encontrado para o workflow: ${workflow_key}`);
    }

    // 2. Protection against cross-workflow trigger (Mismatch check)
    // If event_name is provided, it should match the template's expected event or be a known variant
    if (event_name && template.trigger_event && event_name !== template.trigger_event && !event_name.startsWith('test.')) {
        console.warn(`[TestWorkflow] Workflow mismatch detected: expected ${template.trigger_event}, received ${event_name}`);
        // We log but proceed if it's a manual test, but strict for production triggers
    }

    // 3. Fetch data for rendering
    let appointment = null;
    if (appointment_id) {
      const { data: apptData } = await supabase
        .from("appointments")
        .select(`
          *,
          customer:customers(name, phone),
          service:services(name, price),
          barber:barbers(name)
        `)
        .eq("id", appointment_id)
        .single();
      appointment = apptData;
    }

    let barbershopName = "Sua Barbearia";
    const { data: tenantData } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
    if (tenantData?.name && !['Barbearia', 'Barbershop'].includes(tenantData.name)) {
      barbershopName = tenantData.name;
    } else {
      const { data: profileData } = await supabase.from("profiles").select("business_name").eq("id", tenantId).maybeSingle();
      if (profileData?.business_name) barbershopName = profileData.business_name;
    }

    const sampleData = {
      customer_name: appointment?.customer?.name || "Cliente Teste",
      barbershop_name: barbershopName,
      service_name: appointment?.service?.name || "Corte Social",
      professional_name: appointment?.barber?.name || "Barbeiro",
      appointment_date: appointment?.start_time ? formatBrazilDate(appointment.start_time) : formatBrazilDate(new Date().toISOString()),
      appointment_time: appointment?.start_time ? formatBrazilTime(appointment.start_time) : "14:30",
      service_price: appointment ? `R$ ${appointment.total_price || appointment.service?.price || 0}` : "R$ 50,00",
      ...body.sample_data
    };

    // 4. Determine template to use
    let messageTemplate = template.template;
    if (workflow_key === 'barbershop_anniversary' && template_variant === 'reminder_7_days') {
      messageTemplate = template.additional_templates?.reminder_7_days || messageTemplate;
    } else if (workflow_key === 'appointment_reminder') {
      const variant = template_variant || "6h";
      if (variant === "6h") {
        messageTemplate = `Olá {customer_name} 👋\n\nPassando para lembrar do seu agendamento na {barbershop_name}.\n\n📋 Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nEstamos te esperando!`;
      } else if (variant === "1h") {
        messageTemplate = `Olá {customer_name} 👋\n\nSeu atendimento na {barbershop_name} está chegando.\n\n⏰ Falta apenas 1 hora para o seu agendamento.\n\n📋 Serviço: {service_name}\n💈 Profissional: {professional_name}\n⏰ Horário: {appointment_time}`;
      } else if (variant === "30m") {
        messageTemplate = `Olá {customer_name} 👋\n\nFaltam 30 minutos para o seu agendamento na {barbershop_name}.\n\n📋 Serviço: {service_name}\n💈 Profissional: {professional_name}\n⏰ Horário: {appointment_time}\n\nDeseja confirmar, reagendar ou cancelar?`;
      }
    }

    const renderedMessage = processAutomationTemplate(messageTemplate, sampleData);

    if (dry_run) {
      return new Response(JSON.stringify({ 
        success: true, 
        dry_run: true, 
        payload: { 
          message: renderedMessage, 
          workflow_key, 
          template_id: template.id 
        } 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (simulate_only) {
      // Create a test log or event
      await supabase.from("automation_logs").insert({
        automation_id: template.id,
        tenant_id: tenantId,
        barber_id: user.id,
        status: "simulated",
        message_type: "simulation",
        processed_template: renderedMessage,
        sent_at: new Date().toISOString(),
        payload: { test_mode: true, simulation: true, workflow_key }
      });

      return new Response(JSON.stringify({ success: true, message: "Simulação registrada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Send WhatsApp (Isolated from real queue)
    const targetPhone = testPhone || appointment?.customer?.phone;
    if (!targetPhone) throw new Error("Telefone de destino não encontrado.");

    const buttons = [];
    if (workflow_key === 'appointment_reminder' && template_variant === '30m') {
      buttons.push(
        { id: "reminder_confirm", label: "Confirmar agendamento" },
        { id: "reminder_reschedule", label: "Reagendar" },
        { id: "reminder_cancel", label: "Cancelar" }
      );
    }

    const sendResult = await sendAutomationMessageV2(supabase, {
      tenant_id: tenantId,
      workflow_key: workflow_key,
      appointment_id: fictitious ? null : appointment_id,
      customer_id: fictitious ? null : appointment?.customer_id,
      customer_phone: targetPhone,
      customer_name: sampleData.customer_name,
      message: renderedMessage,
      buttons: buttons,
      payload: { 
        test_mode: true, 
        template_variant,
        reminder_type: template_variant 
      }
    });

    if (!sendResult.success) {
      throw new Error(sendResult.error || "Erro ao enviar WhatsApp");
    }

    // 6. Manual log for test
    await supabase.from("automation_logs").insert({
      automation_id: template.id,
      tenant_id: tenantId,
      barber_id: user.id,
      phone: targetPhone,
      status: "success",
      message_type: "test_manual",
      processed_template: renderedMessage,
      original_template: template.template,
      sent_at: new Date().toISOString(),
      payload: { test_mode: true, template_variant, dispatch_id: sendResult.dispatch_id },
      response: sendResult.provider_response
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Teste enviado com sucesso",
      dispatch_id: sendResult.dispatch_id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Test Workflow Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
