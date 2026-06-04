import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AUTOMATION_V2_STATES, FLOW_TYPES } from "../../_shared/automation-v2-constants.ts";

export async function processSingleFlow(supabase: any, item: any) {
    console.log(`[SingleFlow] Processing item ${item.id}`);
    
    // 1. Get Workflow Config
    const { data: workflow } = await supabase
        .from("automation_v2_workflows")
        .select("*")
        .eq("workflow_key", item.workflow_key)
        .eq("tenant_id", item.tenant_id)
        .single();

    if (!workflow) throw new Error(`Workflow not found for key: ${item.workflow_key}`);
    if (!workflow.active) {
        console.log(`[SingleFlow] Workflow ${item.workflow_key} is inactive. Skipping.`);
        return { success: false, reason: "inactive" };
    }

    // 2. Get Context
    const { data: appointment } = await supabase
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

    if (!appointment) throw new Error("Appointment not found");

    const tenantId = item.tenant_id;
    const phone = appointment.customers?.phone?.replace(/\D/g, "") || item.payload?.phone;
    
    if (!phone) throw new Error("Phone number not found");

    // 3. Format Message
    const template = workflow.configuration?.template || "Olá {customer_name}! Seu agendamento foi realizado.";
    const message = renderTemplate(template, appointment);

    // Default buttons for single flow confirmation
    const buttons = [
        { id: "main_confirm", label: "Confirmar agendamento" },
        { id: "main_reschedule", label: "Reagendar" },
        { id: "main_cancel", label: "Cancelar" }
    ];

    // 4. Create Session (only for interactive flows)
    const { data: session } = await supabase
        .from("automation_v2_sessions")
        .insert({
            tenant_id: tenantId,
            customer_id: appointment.customer_id,
            phone: phone,
            flow_type: FLOW_TYPES.SINGLE,
            current_step: AUTOMATION_V2_STATES.SINGLE_AWAITING_MAIN_ACTION,
            status: 'active',
            appointment_id: appointment.id,
            context: { 
                appointment_details: appointment,
                workflow_key: item.workflow_key
            }
        })
        .select()
        .single();

    // 5. Send Message via Z-API (Mocked/Simplified for now)
    // Here we would call the Z-API integration
    const providerMessageId = `msg_${Math.random().toString(36).substr(2, 9)}`;

    await supabase.from("automation_v2_sessions").update({ provider_message_id: providerMessageId }).eq("id", session.id);
    
    return { success: true, providerMessageId, message };
}

function renderTemplate(template: string, data: any) {
    let rendered = template;
    const dateStr = data.start_time ? new Date(data.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : "";
    const timeStr = data.start_time ? new Date(data.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : "";

    const vars: any = {
        "{customer_name}": data.customers?.name || "Cliente",
        "{barbershop_name}": data.profiles?.full_name || "Barbearia",
        "{service_name}": data.services?.name || "Serviço",
        "{professional_name}": data.barbers?.name || "Profissional",
        "{appointment_date}": dateStr,
        "{appointment_time}": timeStr,
        "{service_price}": data.services?.price ? `R$ ${data.services.price}` : "R$ 0,00",
        "{appointment_status}": data.status || "Pendente",
        "{credit_amount}": data.credits_used ? `R$ ${data.credits_used}` : "R$ 0,00",
        "{cashback_amount}": data.cashback_earned ? `R$ ${data.cashback_earned}` : "R$ 0,00",
        "{payment_method}": data.payment_method || "Não definido"
    };

    for (const [key, value] of Object.entries(vars)) {
        rendered = rendered.split(key).join(String(value));
    }

    return rendered;
}
