import { AUTOMATION_STATES, FLOW_TYPES } from "../../_shared/automation-engine.ts";
import { sendMessage, getWhatsAppSettings } from "../../_shared/whatsapp-settings.ts";
import { formatBrazilTime } from "../../_shared/utils.ts";

export async function handleSingleFlowResponse(supabase: any, session: any, optionId: string, normalizedPhone: string) {
  const tenantId = session.tenant_id;
  const connection = await getWhatsAppSettings(supabase, tenantId);
  const currentStep = session.current_step;
  const ctx = session.context || {};
  
  console.log(`[SingleFlow] Handling option ${optionId} in step ${currentStep}`);

  if (currentStep === AUTOMATION_STATES.SINGLE_AWAITING_MAIN_ACTION) {
    if (optionId === 'main_confirm') {
      // 1. Update appointment
      await supabase.from("appointments").update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString() 
      }).eq("id", session.appointment_id);

      // 2. Success message
      const msg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na Barbearia LM.\n\n⏰ ${ctx.time || ''}\n💈 ${ctx.barber_name || ''}\n✂️ ${ctx.service_name || ''}`;
      
      if (connection) await sendMessage(connection, normalizedPhone, msg);
      
      // 3. Close session
      await supabase.from("conversation_sessions").update({ 
        status: 'closed', 
        current_step: AUTOMATION_STATES.SINGLE_COMPLETED,
        closed_at: new Date().toISOString(),
        active: false 
      }).eq("id", session.id);

      return { action: 'confirmed' };
    } else if (optionId === 'main_reschedule') {
      const msg = "Para reagendar, por favor nos informe a nova data e horário desejados ou entre em contato diretamente.";
      if (connection) await sendMessage(connection, normalizedPhone, msg);
      return { action: 'reschedule_requested' };
    } else if (optionId === 'main_cancel') {
       // Similar for cancel
       await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", session.appointment_id);
       const msg = "❌ Agendamento cancelado com sucesso.";
       if (connection) await sendMessage(connection, normalizedPhone, msg);
       
       await supabase.from("conversation_sessions").update({ 
        status: 'closed', 
        current_step: AUTOMATION_STATES.SINGLE_COMPLETED,
        closed_at: new Date().toISOString(),
        active: false 
      }).eq("id", session.id);
       return { action: 'cancelled' };
    }
  }

  return { error: 'Option not handled in current step' };
}
