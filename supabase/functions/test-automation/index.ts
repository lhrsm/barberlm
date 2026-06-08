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
    if (!authHeader) throw new Error("Missing Authorization header");
    
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

    // Legacy support or check if it's the old call format
    const isLegacy = body.automationId && body.template;
    if (isLegacy) {
        console.log("[TestWorkflow] Handling legacy test call");
        // We can either handle it here or redirect. Let's handle it for backward compatibility
        return handleLegacyTest(supabase, user, body);
    }

    if (!test_mode && !simulate_only && !dry_run) {
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

    // 2. Data for rendering
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

    // 3. Determine template to use
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
        messageTemplate = `Olá {customer_name} 👋\n\nFaltam 30 minutos para o seu agendamento na {barbershop_name}.\n\n📋 Serviço: {service_name}\n💈 Profissional: {professional_name}\n⏰ Horário: {appointment_time}`;
      } else if (variant === "management_link") {
        messageTemplate = `Olá {customer_name} 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\n🔗 Gerencie seu agendamento aqui:\nhttps://barberlm.lovable.app/agendamento/${appointment?.management_token || 'TOKEN_TESTE'}?tenant=${tenantId}\n\nObrigado!`;
      }
    } else if (workflow_key === 'appointment_confirmation') {
      messageTemplate = `Olá {customer_name} 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\n🔗 Gerencie seu agendamento aqui:\nhttps://barberlm.lovable.app/agendamento/${appointment?.management_token || 'TOKEN_TESTE'}?tenant=${tenantId}\n\nObrigado!`;
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
      // Get valid automation_id from automations table
      const { data: autoId } = await supabase.rpc('get_or_create_automation', {
        p_tenant_id: tenantId,
        p_type: workflow_key === 'appointment_confirmation' ? 'new_appointment' : workflow_key
      });

      await supabase.from("automation_logs").insert({
        automation_id: autoId || null,
        tenant_id: tenantId,
        barber_id: user.id,
        status: "simulated",
        message_type: "simulation",
        processed_template: renderedMessage,
        sent_at: new Date().toISOString(),
        payload: { test_mode: true, simulation: true, workflow_key, template_id: template.id }
      });

      return new Response(JSON.stringify({ success: true, message: "Simulação registrada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Send WhatsApp
    const targetPhone = testPhone || appointment?.customer?.phone;
    if (!targetPhone) throw new Error("Telefone de destino não encontrado.");

    const buttons = [];
    // DEPRECATED: Buttons no longer attached to tests.

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

    // 5. Manual log for test
    const { data: autoId } = await supabase.rpc('get_or_create_automation', {
      p_tenant_id: tenantId,
      p_type: workflow_key === 'appointment_confirmation' ? 'new_appointment' : workflow_key
    });

    await supabase.from("automation_logs").insert({
      automation_id: autoId || null,
      tenant_id: tenantId,
      barber_id: user.id,
      phone: targetPhone,
      status: "success",
      message_type: "test_manual",
      processed_template: renderedMessage,
      original_template: template.template,
      sent_at: new Date().toISOString(),
      payload: { test_mode: true, template_variant, dispatch_id: sendResult.dispatch_id, template_id: template.id },
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

async function handleLegacyTest(supabase: any, user: any, body: any) {
    const { automationId, automationType, template, phone: testPhone } = body;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = profile?.tenant_id || profile?.id;
    
    const { data: appt } = await supabase
      .from("appointments")
      .select("*, customers(*), barbers:barber_id(*), profiles:tenant_id(*), services:service_id(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const mockData = {
      cliente_nome: appt?.customers?.name || appt?.name || "João da Silva",
      barbearia_nome: appt?.profiles?.business_name || "Sua Barbearia",
      data: appt ? formatBrazilDate(appt.start_time) : formatBrazilDate(new Date().toISOString()),
      horario: appt ? formatBrazilTime(appt.start_time) : "14:30",
      profissional: appt?.barbers?.name || "Seu Barbeiro",
      servico: appt?.services?.name || "Corte Social",
    };

    const processedMessage = processAutomationTemplate(template, mockData);
    const targetPhone = testPhone || appt?.customers?.phone || "5571999999999";

    const sendResult = await sendAutomationMessageV2(supabase, {
      tenant_id: tenantId,
      workflow_key: automationType || 'legacy_test',
      customer_phone: targetPhone,
      customer_name: mockData.cliente_nome,
      message: processedMessage,
      payload: { test_mode: true, legacy: true }
    });

    if (!sendResult.success) throw new Error(sendResult.error);

    return new Response(JSON.stringify({ 
      success: true, 
      processedMessage,
      dispatch_id: sendResult.dispatch_id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
}
