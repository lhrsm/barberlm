import { AUTOMATION_STATES, FLOW_TYPES } from "../../_shared/automation-engine.ts";
import { sendMessage, getWhatsAppSettings } from "../../_shared/whatsapp-settings.ts";
import { formatBrazilTime } from "../../_shared/utils.ts";

export async function handleMultiFlowResponse(supabase: any, session: any, optionId: string, normalizedPhone: string) {
  const tenantId = session.tenant_id;
  const connection = await getWhatsAppSettings(supabase, tenantId);
  const currentStep = session.current_step;
  const ctx = session.context || {};
  const groupId = session.appointment_group_id;

  console.log(`[MultiFlow] Handling option ${optionId} in step ${currentStep}`);

  if (currentStep === AUTOMATION_STATES.MULTI_AWAITING_MAIN_ACTION) {
    if (optionId === 'main_confirm') {
      const msg = "Como você deseja confirmar seus agendamentos?";
      const buttons = [
        { id: "confirm_all", label: "Confirmar todos" },
        { id: "confirm_specific", label: "Confirmar um específico" }
      ];
      if (connection) await sendMessage(connection, normalizedPhone, msg, { buttons });
      
      await supabase.from("conversation_sessions").update({ 
        current_step: AUTOMATION_STATES.MULTI_AWAITING_CONFIRM_SCOPE 
      }).eq("id", session.id);
      
      return { action: 'asked_confirm_scope' };
    }
    // Handle reschedule/cancel similarly...
  }

  if (currentStep === AUTOMATION_STATES.MULTI_AWAITING_CONFIRM_SCOPE) {
    if (optionId === 'confirm_all') {
      await supabase.from("appointments").update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString() 
      }).eq("appointment_group_id", groupId);

      const msg = "✅ Todos os seus agendamentos foram confirmados com sucesso!";
      if (connection) await sendMessage(connection, normalizedPhone, msg);
      
      await supabase.from("conversation_sessions").update({ 
        status: 'closed', 
        current_step: AUTOMATION_STATES.MULTI_COMPLETED,
        closed_at: new Date().toISOString(),
        active: false 
      }).eq("id", session.id);

      return { action: 'confirmed_all' };
    } else if (optionId === 'confirm_specific') {
      // List appointments
      const { data: appts } = await supabase.from("appointments").select("*, services(name)").eq("appointment_group_id", groupId);
      
      let listMsg = "Escolha qual agendamento deseja confirmar:\n";
      const options = appts?.map((a: any, i: number) => ({
        id: `confirm_appt_${a.id}`,
        title: `${formatBrazilTime(a.start_time)}`,
        description: a.services?.name
      }));

      if (connection) {
        await sendMessage(connection, normalizedPhone, listMsg, {
          list: {
            buttonLabel: "Ver agendamentos",
            title: "Seus Agendamentos",
            options
          }
        });
      }

      await supabase.from("conversation_sessions").update({ 
        current_step: AUTOMATION_STATES.MULTI_AWAITING_SPECIFIC_SELECTION 
      }).eq("id", session.id);

      return { action: 'asked_specific_selection' };
    }
  }

  if (currentStep === AUTOMATION_STATES.MULTI_AWAITING_SPECIFIC_SELECTION) {
    if (optionId.startsWith('confirm_appt_')) {
      const apptId = optionId.replace('confirm_appt_', '');
      
      await supabase.from("appointments").update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString() 
      }).eq("id", apptId);

      const msg = "✅ Agendamento confirmado! O que deseja fazer com os demais?";
      const buttons = [
        { id: "confirm_all", label: "Confirmar demais" },
        { id: "main_cancel", label: "Cancelar demais" }
      ];
      
      if (connection) await sendMessage(connection, normalizedPhone, msg, { buttons });

      await supabase.from("conversation_sessions").update({ 
        current_step: AUTOMATION_STATES.MULTI_AWAITING_REMAINING_ACTION 
      }).eq("id", session.id);

      return { action: 'confirmed_specific' };
    }
  }

  if (currentStep === AUTOMATION_STATES.MULTI_AWAITING_REMAINING_ACTION) {
      if (optionId === 'confirm_all') {
          await supabase.from("appointments")
            .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
            .eq("appointment_group_id", groupId)
            .eq("status", 'pending');
            
          const msg = "✅ Todos os agendamentos restantes foram confirmados.";
          if (connection) await sendMessage(connection, normalizedPhone, msg);
          
          await supabase.from("conversation_sessions").update({ 
            status: 'closed', 
            current_step: AUTOMATION_STATES.MULTI_COMPLETED,
            closed_at: new Date().toISOString(),
            active: false 
          }).eq("id", session.id);
          
          return { action: 'confirmed_remaining' };
      }
  }

  return { error: 'Option not handled' };
}
