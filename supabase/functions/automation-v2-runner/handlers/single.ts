import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AUTOMATION_V2_STATES, FLOW_TYPES } from "../../_shared/automation-v2-constants.ts";

export async function processSingleFlow(supabase: any, item: any) {
    console.log(`[SingleFlow] Processing item ${item.id}`);
    
    // 1. Get Context
    const { data: appointment } = await supabase
        .from("appointments")
        .select(`
            *,
            customers (*),
            services (*),
            professionals (*)
        `)
        .eq("id", item.appointment_id)
        .single();

    if (!appointment) throw new Error("Appointment not found");

    const tenantId = item.tenant_id;
    const phone = appointment.customers?.phone?.replace(/\D/g, "");
    
    // 2. Format Message (America/Sao_Paulo)
    const dateStr = new Date(appointment.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const timeStr = new Date(appointment.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

    const message = `Olá ${appointment.customers?.name} 👋\n\nSeu agendamento foi realizado com sucesso.\n\n📋 Resumo:\n✅ Serviço: ${appointment.services?.name}\n💈 Profissional: ${appointment.professionals?.name}\n📅 Data: ${dateStr}\n⏰ Horário: ${timeStr}\n\nO que deseja fazer?`;

    const buttons = [
        { id: "main_confirm", label: "Confirmar agendamento" },
        { id: "main_reschedule", label: "Reagendar" },
        { id: "main_cancel", label: "Cancelar" }
    ];

    // 3. Create Session
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
            context: { appointment_details: appointment }
        })
        .select()
        .single();

    // 4. Send Message via Z-API (Mocked/Simplified for now)
    const providerMessageId = `msg_${Math.random().toString(36).substr(2, 9)}`;

    await supabase.from("automation_v2_sessions").update({ provider_message_id: providerMessageId }).eq("id", session.id);
    
    return { success: true, providerMessageId };
}
