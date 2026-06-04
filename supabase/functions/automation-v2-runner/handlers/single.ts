import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AUTOMATION_V2_STATES, FLOW_TYPES } from "../../_shared/automation-v2-constants.ts";
import { getWhatsAppSettings, sendMessage } from "../../_shared/whatsapp-settings.ts";

export async function processSingleFlow(supabase: any, item: any) {
    console.log(`[SingleFlow] Processing item ${item.id}`, { workflow_key: item.workflow_key, tenant_id: item.tenant_id });
    
    // 1. Get Workflow Config
    const { data: workflow, error: workflowError } = await supabase
        .from("automation_v2_workflows")
        .select("*")
        .eq("workflow_key", item.workflow_key)
        .eq("tenant_id", item.tenant_id)
        .single();

    if (workflowError) {
        console.error(`[SingleFlow] Error fetching workflow:`, workflowError);
        throw new Error(`Workflow not found for key: ${item.workflow_key}`);
    }
    
    if (!workflow) throw new Error(`Workflow not found for key: ${item.workflow_key}`);
    
    if (!workflow.active && !item.id.startsWith('test_')) {
        console.log(`[SingleFlow] Workflow ${item.workflow_key} is inactive. Skipping.`);
        return { success: false, reason: "inactive" };
    }

    // 2. Get Context
    const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .select(`
            *,
            customers (*),
            services (*),
            profiles (*),
            barbers (*)
        `)
        .eq("id", item.appointment_id)
        .maybeSingle();

    if (apptError) {
        console.error(`[SingleFlow] Error fetching appointment:`, apptError);
        throw new Error(`Appointment not found: ${apptError.message}`);
    }

    if (!appointment && !item.id.startsWith('test_')) {
        throw new Error("Appointment not found");
    }

    // Use appointment data if available, otherwise use dummy for test if needed
    const context = appointment || {
        customers: { name: "Cliente Teste", phone: item.payload?.phone },
        profiles: { full_name: "Barbearia Modelo" },
        services: { name: "Corte", price: 50 },
        barbers: { name: "Barbeiro" },
        start_time: new Date().toISOString()
    };

    const tenantId = item.tenant_id;
    const phone = context.customers?.phone?.replace(/\D/g, "") || item.payload?.phone;
    
    if (!phone) throw new Error("Phone number not found (customer phone or payload phone)");

    // 3. WhatsApp Settings
    const connection = await getWhatsAppSettings(supabase, tenantId);
    if (!connection) {
        throw new Error("WhatsApp (Z-API) connection not configured for this tenant");
    }

    // 4. Format Message
    const template = workflow.configuration?.template || "Olá {customer_name}! Seu agendamento foi realizado.";
    const message = renderTemplate(template, context);

    // Default buttons for single flow confirmation
    const buttons = [
        { id: "main_confirm", label: "Confirmar agendamento" },
        { id: "main_reschedule", label: "Reagendar" },
        { id: "main_cancel", label: "Cancelar" }
    ];

    // 5. Create Session (only for interactive flows)
    // We only create a real session if it's NOT a test, or if we want to test sessions too
    const { data: session, error: sessionError } = await supabase
        .from("automation_v2_sessions")
        .insert({
            tenant_id: tenantId,
            customer_id: context.customer_id || null,
            phone: phone,
            flow_type: FLOW_TYPES.SINGLE,
            current_step: AUTOMATION_V2_STATES.SINGLE_AWAITING_MAIN_ACTION,
            status: 'active',
            appointment_id: context.id || null,
            context: { 
                appointment_details: context,
                workflow_key: item.workflow_key,
                is_test: item.id.startsWith('test_')
            }
        })
        .select()
        .single();

    if (sessionError) {
        console.error(`[SingleFlow] Error creating session:`, sessionError);
        throw new Error(`Failed to create automation session: ${sessionError.message}`);
    }

    // 6. Send Message via Z-API
    console.log(`[SingleFlow] Sending message to ${phone} via Z-API`);
    const zapiResult = await sendMessage(connection, phone, message, { buttons });

    if (!zapiResult.success) {
        console.error(`[SingleFlow] Z-API Error:`, zapiResult.error);
        await supabase.from("automation_v2_sessions").update({ 
            status: "failed", 
            error: zapiResult.error 
        }).eq("id", session.id);
        
        throw new Error(`Z-API Error: ${zapiResult.error}`);
    }

    const providerMessageId = zapiResult.response?.messageId || `msg_${Math.random().toString(36).substr(2, 9)}`;

    await supabase.from("automation_v2_sessions").update({ 
        provider_message_id: providerMessageId 
    }).eq("id", session.id);
    
    return { success: true, providerMessageId, message };
}

function renderTemplate(template: string, data: any) {
    let rendered = template;
    const dateStr = data.start_time ? new Date(data.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : "";
    const timeStr = data.start_time ? new Date(data.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : "";

    const vars: any = {
        "{customer_name}": data.customers?.name || "Cliente",
        "{barbershop_name}": data.profiles?.business_name || data.profiles?.full_name || "Barbearia",
        "{service_name}": data.services?.name || "Serviço",
        "{professional_name}": data.barbers?.name || "Profissional",
        "{appointment_date}": dateStr,
        "{appointment_time}": timeStr,
        "{service_price}": data.services?.price ? `R$ ${data.services.price}` : "R$ 0,00",
        "{appointment_status}": data.status || "Pendente",
        "{credit_amount}": data.credit_used || data.credits_used ? `R$ ${data.credit_used || data.credits_used}` : "R$ 0,00",
        "{cashback_amount}": data.cashback_earned ? `R$ ${data.cashback_earned}` : "R$ 0,00",
        "{payment_method}": data.payment_method || "Não definido",
        "{appointments_list}": "(Lista de agendamentos não disponível em fluxo único)"
    };

    for (const [key, value] of Object.entries(vars)) {
        rendered = rendered.split(key).join(String(value));
    }

    return rendered;
}