import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { format, parse } from "https://esm.sh/date-fns@2.30.0";
import { ptBR } from "https://esm.sh/date-fns@2.30.0/locale";
import { formatBrazilDate, formatBrazilTime, normalizePhone, removeNinthDigit } from "./utils.ts";
import { sendMessage, getWhatsAppSettings } from "./whatsapp-settings.ts";
import { processAutomationTemplate, containsPlaceholders } from "./template-parser.ts";

export const AUTOMATION_STATES = {
  AWAITING_MAIN_ACTION: 'awaiting_main_action',
  AWAITING_CONFIRMATION_SCOPE: 'awaiting_confirm_scope',
  AWAITING_SPECIFIC_APPOINTMENT_SELECTION: 'awaiting_specific_selection',
  AWAITING_REMAINING_APPOINTMENT_ACTION: 'awaiting_remaining_action',
  AWAITING_RESCHEDULE_SCOPE: 'awaiting_reschedule_scope',
  AWAITING_RESCHEDULE_DATE: 'awaiting_reschedule_date',
  AWAITING_CANCEL_CONFIRMATION: 'awaiting_cancel_confirmation',
  AWAITING_CANCEL_SCOPE: 'awaiting_cancel_scope',
  COMPLETED: 'completed',
  EXPIRED: 'expired'
};

export const AUTOMATION_TYPES = {
  CONFIRMATION: 'appointment_confirmation',
  REMINDER: 'appointment_reminder',
  RESCHEDULING: 'rescheduling',
  CANCELLATION: 'cancellation'
};

export async function handleAutomationWhatsappResponse(
  supabase: any,
  {
    tenant_id,
    phone,
    customer_id,
    current_state,
    option_id,
    payload,
    conversation_id
  }: any
) {
  console.log(`[AutomationEngine] Handling response for ${phone} in state ${current_state} with option ${option_id}`);

  const { data: conversation, error: convError } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", conversation_id)
    .maybeSingle();

  if (!conversation) {
    console.log("[AutomationEngine] No conversation found for ID:", conversation_id);
    return null;
  }

  const groupId = conversation.appointment_group_id;
  
  // Get appointments for this group or conversation
  let appointmentsQuery = supabase
    .from("appointments")
    .select("*, services(name)");

  if (groupId) {
    appointmentsQuery = appointmentsQuery.eq("appointment_group_id", groupId);
  } else {
    // If no group, get the specific appointment from the conversation or recent pending ones for this customer
    if (conversation.appointment_id) {
      appointmentsQuery = appointmentsQuery.eq("id", conversation.appointment_id);
    } else {
      appointmentsQuery = appointmentsQuery
        .eq("customer_id", conversation.customer_id)
        .in("status", ['scheduled', 'pending', 'awaiting_payment', 'confirmed'])
        .order("start_time", { ascending: true });
    }
  }

  const { data: appointments } = await appointmentsQuery;


  const isMultiple = appointments && appointments.length > 1;
  const appointmentIds = appointments?.map(a => a.id) || [];

  let nextState = current_state;
  let messageToSend = "";
  let actionExecuted = "";
  let selectedOptionNormalized = option_id;
  let buttons: any[] | undefined = undefined;


  // Normalize and Map options
  const rawInput = String(option_id).trim().toLowerCase();
  const normalizedInput = rawInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  console.log('[AutomationEngine] Normalizing input:', rawInput, '->', normalizedInput);

  let mappedOption = rawInput;
  
  // Mapping logic as requested - very explicit
  if (
    normalizedInput === 'main_confirm' || 
    normalizedInput === 'confirm_appointment' || 
    normalizedInput === 'confirmar_atendimento' ||
    normalizedInput === 'confirmar_agendamento' ||
    normalizedInput.includes('confirmar agendamento') || 
    normalizedInput.includes('confirmar atendimento') || 
    normalizedInput.includes('confirmar') || 
    normalizedInput === 'confirm' || 
    normalizedInput === '1'
  ) {
    mappedOption = 'main_confirm';
  } else if (
    normalizedInput === 'main_reschedule' || 
    normalizedInput === 'reschedule_appointment' || 
    normalizedInput === 'reagendar_agendamento' ||
    normalizedInput.includes('reagendar') || 
    normalizedInput === 'reschedule' || 
    normalizedInput === '2'
  ) {
    mappedOption = 'main_reschedule';
  } else if (
    normalizedInput === 'main_cancel' || 
    normalizedInput === 'cancel_appointment' || 
    normalizedInput === 'cancelar_agendamento' ||
    normalizedInput.includes('cancelar') || 
    normalizedInput === 'cancel' || 
    normalizedInput === '3'
  ) {
    mappedOption = 'main_cancel';
  }

  // Handle case where Z-API returns the ID directly (like "main_confirm")
  if (rawInput === 'main_confirm') mappedOption = 'main_confirm';
  if (rawInput === 'main_reschedule') mappedOption = 'main_reschedule';
  if (rawInput === 'main_cancel') mappedOption = 'main_cancel';

  console.log('[AutomationEngine] MAPPED OPTION:', mappedOption);
  console.log('CONVERSATION STATE:', current_state);
  console.log('APPOINTMENTS COUNT:', appointments?.length || 0);

  // State Machine Logic
  switch (current_state) {
    case AUTOMATION_STATES.AWAITING_MAIN_ACTION:
      if (mappedOption === 'main_confirm') {
        console.log('NEXT ACTION: Confirm');
        if (!isMultiple) {
          // Confirm direct
          await supabase.from("appointments").update({ status: 'confirmed' }).in("id", appointmentIds);
          messageToSend = "✅ Seu agendamento foi confirmado com sucesso! Te esperamos aqui.";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "confirm_direct";
          selectedOptionNormalized = "main_confirm";
        } else {
          // Multiple: Ask scope
          messageToSend = "Como você deseja confirmar seus agendamentos?";
          buttons = [
            { id: "confirm_all", label: "Confirmar todos" },
            { id: "confirm_single", label: "Confirmar um específico" }
          ];
          nextState = AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE;
          actionExecuted = "ask_confirmation_scope";
          selectedOptionNormalized = "main_confirm";
        }
      } else if (mappedOption === 'main_reschedule') {
        console.log('NEXT ACTION: Reschedule');
        if (!isMultiple) {
          // Start reschedule for single
          messageToSend = "Vamos reagendar seu atendimento. Para qual nova data e horário você gostaria de mudar? (Ex: amanhã às 14h)";
          nextState = AUTOMATION_STATES.AWAITING_RESCHEDULE_DATE;
          actionExecuted = "reschedule_direct";
          selectedOptionNormalized = "main_reschedule";
        } else {
          // Multiple: Ask scope
          messageToSend = "Como você deseja reagendar seus agendamentos?";
          buttons = [
            { id: "reschedule_all", label: "Reagendar todos" },
            { id: "reschedule_single", label: "Reagendar um específico" }
          ];
          nextState = AUTOMATION_STATES.AWAITING_RESCHEDULE_SCOPE;
          actionExecuted = "ask_reschedule_scope";
          selectedOptionNormalized = "main_reschedule";
        }
      } else if (mappedOption === 'main_cancel') {
        console.log('NEXT ACTION: Cancel');
        if (!isMultiple) {
          messageToSend = "Tem certeza que deseja cancelar seu agendamento?";
          buttons = [
            { id: "cancel_yes", label: "Sim, cancelar" },
            { id: "cancel_no", label: "Não, manter" }
          ];
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_CONFIRMATION;
          actionExecuted = "ask_cancel_confirmation";
          selectedOptionNormalized = "main_cancel";
        } else {
          // Multiple: Ask scope
          messageToSend = "Como você deseja cancelar seus agendamentos?";
          buttons = [
            { id: "cancel_all", label: "Cancelar todos" },
            { id: "cancel_single", label: "Cancelar um específico" }
          ];
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_SCOPE;
          actionExecuted = "ask_cancel_scope";
          selectedOptionNormalized = "main_cancel";
        }
      } else {
        console.log('NEXT ACTION: Invalid');
        messageToSend = "Não consegui entender sua escolha. 🤔\n\nPor favor, escolha uma das opções abaixo:";
        buttons = [
          { id: "main_confirm", label: "Confirmar agendamento" },
          { id: "main_reschedule", label: "Reagendar" },
          { id: "main_cancel", label: "Cancelar" }
        ];
        actionExecuted = "invalid_option_main";
      }

      break;

    case AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE:
      if (normalizedOption === 'confirm_all' || normalizedOption === '1') {
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", appointmentIds);
        messageToSend = "✅ Todos os seus agendamentos foram confirmados com sucesso!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_all";
        selectedOptionNormalized = "confirm_all";
      } else if (normalizedOption === 'confirm_single' || normalizedOption === '2') {
        messageToSend = "Qual atendimento você deseja confirmar?";
        const options = appointments.map((a, i) => ({
          id: `appointment:${a.id}`,
          title: `${formatBrazilTime(a.start_time)}`,
          description: `${a.services?.name}`
        }));

        
        await supabase.from("whatsapp_conversations")
          .update({ 
            context: { ...conversation.context, appt_mapping: appointmentIds }
          })
          .eq("id", conversation_id);
          
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_selection";
        selectedOptionNormalized = "confirm_single";
        return {
          action_executed: actionExecuted,
          next_state: nextState,
          message_to_send: messageToSend,
          selected_option_normalized: selectedOptionNormalized,
          list: {
            buttonLabel: "Ver agendamentos",
            title: "Seus Agendamentos",
            options
          }
        };
      } else {
        messageToSend = "Opção inválida.";
        buttons = [
          { id: "confirm_all", label: "Confirmar todos" },
          { id: "confirm_single", label: "Confirmar um específico" }
        ];
      }

      break;

    case AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION:
      const cancelMode = conversation.context?.cancel_mode === true;
      let selectedId = "";

      if (normalizedOption.includes('appointment:')) {
        selectedId = normalizedOption.split(':')[1];
      } else {
        // Fallback for numbered text response
        const mapping = conversation.context?.appt_mapping || appointmentIds;
        const index = parseInt(normalizedOption) - 1;
        if (!isNaN(index) && index >= 0 && index < mapping.length) {
          selectedId = mapping[index];
        }
      }

      if (selectedId) {
        const newStatus = cancelMode ? 'cancelled' : 'confirmed';
        await supabase.from("appointments").update({ status: newStatus }).eq("id", selectedId);
        
        const remainingIds = appointmentIds.filter(id => id !== selectedId);
        
        if (remainingIds.length > 0) {
          const actionText = cancelMode ? "cancelado" : "confirmado";
          messageToSend = `✅ Agendamento ${actionText}! O que deseja fazer com os demais agendamentos?`;
          buttons = [
            { id: "1", label: "Confirmar demais" },
            { id: "2", label: "Reagendar demais" },
            { id: "3", label: "Cancelar demais" }
          ];
          nextState = AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION;

          
          await supabase.from("whatsapp_conversations")
            .update({ 
              context: { 
                ...conversation.context, 
                selected_appointment_id: selectedId,
                remaining_appointment_ids: remainingIds 
              }
            })
            .eq("id", conversation_id);
        } else {
          const successText = cancelMode ? "cancelado" : "confirmado";
          messageToSend = `✅ Agendamento ${successText} com sucesso!`;
          nextState = AUTOMATION_STATES.COMPLETED;
        }
        actionExecuted = `${cancelMode ? 'cancel' : 'confirm'}_specific`;
      } else {
        messageToSend = "Opção inválida. Por favor, digite o número correspondente ao atendimento desejado.";
      }
      break;

    case AUTOMATION_STATES.AWAITING_CANCEL_CONFIRMATION:
      if (normalizedOption === 'cancel_yes' || normalizedOption === '1' || normalizedOption.includes('sim')) {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", appointmentIds);
        messageToSend = "❌ Agendamento cancelado com sucesso.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_executed";
        selectedOptionNormalized = "cancel_yes";
      } else if (normalizedOption === 'cancel_no' || normalizedOption === '2' || normalizedOption.includes('nao')) {
        messageToSend = "Perfeito! Seu agendamento continua mantido. Te esperamos!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_aborted";
        selectedOptionNormalized = "cancel_no";
      } else {
        messageToSend = "Opção inválida. Escolha uma das opções abaixo:";
        buttons = [
          { id: "cancel_yes", label: "Sim, cancelar" },
          { id: "cancel_no", label: "Não, manter" }
        ];
      }
      break;


    case AUTOMATION_STATES.AWAITING_CANCEL_SCOPE:
      if (normalizedOption === 'cancel_all' || normalizedOption === '1') {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", appointmentIds);
        messageToSend = "❌ Todos os seus agendamentos foram cancelados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_all";
        selectedOptionNormalized = "cancel_all";
      } else if (normalizedOption === 'cancel_single' || normalizedOption === '2') {
        messageToSend = "Qual atendimento você deseja cancelar?";
        const options = appointments.map((a, i) => ({
          id: `appointment:${a.id}`,
          title: `${formatBrazilTime(a.start_time)}`,
          description: `${a.services?.name}`
        }));

        
        await supabase.from("whatsapp_conversations")
          .update({ 
            context: { ...conversation.context, appt_mapping: appointmentIds, cancel_mode: true }
          })
          .eq("id", conversation_id);
          
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_selection_cancel";
        selectedOptionNormalized = "cancel_single";
        return {
          action_executed: actionExecuted,
          next_state: nextState,
          message_to_send: messageToSend,
          selected_option_normalized: selectedOptionNormalized,
          list: {
            buttonLabel: "Ver agendamentos",
            title: "Cancelar Agendamento",
            options
          }
        };
      } else {
        messageToSend = "Opção inválida.";
        buttons = [
          { id: "cancel_all", label: "Cancelar todos" },
          { id: "cancel_single", label: "Cancelar um específico" }
        ];
      }
      break;


    case AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION:
      const remainingIds = conversation.context?.remaining_appointment_ids || [];
      if (normalizedOption === '1' || normalizedOption.includes('confirmar')) {
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", remainingIds);
        messageToSend = "✅ Todos os agendamentos restantes foram confirmados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_remaining";
      } else if (normalizedOption === '2' || normalizedOption.includes('reagendar')) {
        messageToSend = "Para reagendar os demais atendimentos, por favor entre em contato conosco.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "reschedule_remaining";
      } else if (normalizedOption === '3' || normalizedOption.includes('cancelar')) {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", remainingIds);
        messageToSend = "❌ Agendamentos restantes foram cancelados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_remaining";
      } else {
        messageToSend = "Opção inválida. O que deseja fazer com os demais agendamentos?";
        buttons = [
          { id: "1", label: "Confirmar demais" },
          { id: "2", label: "Reagendar demais" },
          { id: "3", label: "Cancelar demais" }
        ];
      }
      break;

      
    case AUTOMATION_STATES.AWAITING_RESCHEDULE_DATE:
      messageToSend = "Recebi sua solicitação de reagendamento. Um atendente irá confirmar as novas datas disponíveis para você em breve.";
      nextState = AUTOMATION_STATES.COMPLETED;
      actionExecuted = "reschedule_requested";
      break;

    case AUTOMATION_STATES.AWAITING_RESCHEDULE_SCOPE:
      if (mappedOption === 'reschedule_all' || mappedOption === '1') {
        messageToSend = "Para reagendar todos os seus atendimentos, por favor informe as novas datas e horários desejados.";
        nextState = AUTOMATION_STATES.AWAITING_RESCHEDULE_DATE;
        actionExecuted = "reschedule_all_ask_date";
      } else if (mappedOption === 'reschedule_single' || mappedOption === '2') {
        messageToSend = "Qual atendimento você deseja reagendar?";
        const options = appointments.map((a, i) => ({
          id: `appointment:${a.id}`,
          title: `${formatBrazilTime(a.start_time)}`,
          description: `${a.services?.name}`
        }));
        
        await supabase.from("whatsapp_conversations")
          .update({ 
            context: { ...conversation.context, appt_mapping: appointmentIds, reschedule_mode: true }
          })
          .eq("id", conversation_id);
          
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_selection_reschedule";
        selectedOptionNormalized = "reschedule_single";
        
        return {
          action_executed: actionExecuted,
          next_state: nextState,
          message_to_send: messageToSend,
          selected_option_normalized: selectedOptionNormalized,
          list: {
            buttonLabel: "Ver agendamentos",
            title: "Reagendar Agendamento",
            options
          }
        };
      } else {
        messageToSend = "Opção inválida. Como deseja reagendar?";
        buttons = [
          { id: "reschedule_all", label: "Reagendar todos" },
          { id: "reschedule_single", label: "Reagendar um específico" }
        ];
      }
      break;

    default:
      messageToSend = "Não consegui entender sua escolha. 🤔\n\nUse o menu de opções ou responda:\n1️⃣ Confirmar\n2️⃣ Reagendar\n3️⃣ Cancelar";
      break;
  }
  
  console.log('[AutomationEngine] FLOW SUMMARY:', {
    actionExecuted,
    nextState,
    messageSent: messageToSend ? 'YES' : 'NO',
    appointmentsCount: appointments?.length || 0
  });

  // Final update of conversation
  const { error: updateError } = await supabase.from("whatsapp_conversations")
    .update({ 
      state: nextState,
      active: nextState !== AUTOMATION_STATES.COMPLETED && nextState !== AUTOMATION_STATES.EXPIRED,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversation_id);

  if (updateError) {
    console.error('[AutomationEngine] Error updating conversation state:', updateError);
  }

  return {
    action_executed: actionExecuted,
    next_state: nextState,
    message_to_send: messageToSend,
    selected_option_normalized: selectedOptionNormalized,
    buttons,
    appointments_count: appointments?.length || 0,
    is_multiple: isMultiple
  };
}



export async function processAutomationDispatches(
  supabase: any,
  { tenantId, appointmentId, forceMode }: { tenantId?: string; appointmentId?: string; forceMode?: boolean }
) {
  const runId = crypto.randomUUID();
  const startTime = new Date().toISOString();
  console.log(`[AutomationEngine] Starting dispatch process ${runId}. Tenant: ${tenantId || 'All'}, Appointment: ${appointmentId || 'All'}, Force: ${forceMode}`);
  
  // Track everything for debug
  const all_details: any[] = [];
  const results = {
    success: true,
    processed_count: 0,
    skipped_count: 0,
    error_count: 0,
    found_count: 0,
    eligible_count: 0,
    messages_sent: [] as any[],
    errors: [] as any[],
    details: [] as string[],
    ignoredRecords: [] as any[]
  };

  try {
    // 1. Initial Insert
    await supabase.from("automation_cron_runs").insert({
      id: runId,
      status: 'running',
      tenant_id: tenantId,
      appointment_id: appointmentId,
      started_at: startTime
    });

    // 2. Build Query
    // We fetch ALL appointments without confirmation to be able to debug why they are not being processed
    let query = supabase
      .from("appointments")
      .select("*, customers(*), barbers(*), services(*), profiles:tenant_id(business_name)")
      .is("confirmation_sent_at", null);

    // Filter by valid statuses for confirmation
    const validStatuses = ['scheduled', 'pending', 'awaiting_payment', 'confirmed'];
    query = query.in("status", validStatuses);

    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (appointmentId) query = query.eq("id", appointmentId);
    
    const { data: allAppointments, error: appError } = await query;

    if (appError) {
      results.details.push(`Query error: ${appError.message}`);
      throw appError;
    }

    results.found_count = allAppointments?.length || 0;
    results.details.push(`Found ${results.found_count} appointments with status ${validStatuses.join(',')} and no confirmation sent.`);

    if (!allAppointments || allAppointments.length === 0) {
      const msg = "Nenhum agendamento pendente encontrado para processamento.";
      results.details.push(msg);
      await supabase.from("automation_cron_runs").update({ 
        status: 'success', 
        finished_at: new Date().toISOString(),
        found_count: 0,
        eligible_count: 0,
        details: { logs: results.details, summary: "No appointments found" }
      }).eq('id', runId);
      return { ...results, message: msg };
    }

    // 3. Determine Eligibility and Log reasons
    const eligibleAppointments: any[] = [];

    for (const appt of allAppointments) {
      let eligible = true;
      let reason = "Elegível";
      const customer = appt.customers;
      
      // Check customer & phone
      if (!customer) {
        eligible = false;
        reason = "Cliente não encontrado";
      } else if (!customer.phone) {
        eligible = false;
        reason = "Cliente sem telefone cadastrado";
      }

      // NO TIME WINDOW FILTER - Process all as requested
      // The only filter is confirmation_sent_at is null (done in query)

      const debugInfo = {
        appointment_id: appt.id,
        status: appt.status,
        customer_id: appt.customer_id,
        phone: customer?.phone || "N/A",
        confirmation_sent_at: appt.confirmation_sent_at,
        created_at: appt.created_at,
        eligible,
        reason
      };

      all_details.push(debugInfo);

      if (eligible) {
        eligibleAppointments.push(appt);
      } else {
        results.ignoredRecords.push(debugInfo);
        results.skipped_count++;
      }
    }

    results.eligible_count = eligibleAppointments.length;
    results.details.push(`${results.eligible_count} agendamentos são elegíveis para envio.`);

    if (eligibleAppointments.length === 0) {
      const msg = "Nenhum agendamento elegível após filtros.";
      await supabase.from("automation_cron_runs").update({ 
        status: 'success', 
        finished_at: new Date().toISOString(),
        found_count: results.found_count,
        eligible_count: 0,
        skipped_count: results.skipped_count,
        processed_appointments: all_details,
        details: { logs: results.details, summary: msg, ignored: results.ignoredRecords }
      }).eq('id', runId);
      return { ...results, message: msg };
    }

    // 4. Grouping - ONLY group if they share an appointment_group_id
    // This prevents single appointments from being treated as multiple just because they share a phone
    const groups: Record<string, any[]> = {};
    for (const appt of eligibleAppointments) {
      // Use group_id if available, otherwise use appointment id itself (no grouping)
      const key = appt.appointment_group_id || `single_${appt.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(appt);
    }

    // 5. Process Groups
    for (const [groupKey, apptGroup] of Object.entries(groups)) {
      try {
        const firstAppt = apptGroup[0];
        const tenant_id = firstAppt.tenant_id;
        const customer = firstAppt.customers;
        const profile = firstAppt.profiles;
        const group_id = firstAppt.appointment_group_id;

        // 1. Idempotency Check
        const normalizedPhoneValue = normalizePhone(customer.phone);
        const fallbackPhoneValue = removeNinthDigit(normalizedPhoneValue);
        
        console.log(`[AutomationEngine] Checking idempotency for ${groupKey} / ${normalizedPhoneValue}`);
        
        // ONLY check if confirmation was already sent. 
        // Existing active conversation should NOT block sending if message was never sent.
        const alreadySent = apptGroup.every(a => a.confirmation_sent_at !== null);
        
        if (alreadySent) {
          console.log(`[AutomationEngine] Group ${groupKey} already has confirmation sent. Skipping to avoid duplication.`);
          results.details.push(`Grupo ${groupKey}: skipped_already_sent (confirmation_sent_at exists)`);
          results.skipped_count += apptGroup.length;
          continue;
        }

        // Check if automation is enabled for this tenant
        const { data: auto } = await supabase
          .from("automations")
          .select("*")
          .eq("tenant_id", tenant_id)
          .eq("type", AUTOMATION_TYPES.CONFIRMATION)
          .eq("enabled", true)
          .maybeSingle();

        if (!auto) {
          const reason = `Automação de confirmação desativada ou não encontrada para tenant ${tenant_id}`;
          console.log(`[AutomationEngine] ${reason}`);
          results.details.push(`Grupo ${groupKey}: ${reason}`);
          apptGroup.forEach(a => {
            const detail = all_details.find(d => d.appointment_id === a.id);
            if (detail) { 
              detail.eligible = false; 
              detail.reason = reason;
              detail.automation_checked = true;
            }
          });
          results.skipped_count += apptGroup.length;
          continue;
        }

        // Add automation info to details for debugging
        apptGroup.forEach(a => {
          const detail = all_details.find(d => d.appointment_id === a.id);
          if (detail) {
            detail.automation_id = auto.id;
            detail.automation_enabled = auto.enabled;
            detail.automation_barber_id = auto.barber_id;
          }
        });

        const isMultiple = apptGroup.length > 1;
        console.log(`[AutomationEngine] Group ${groupKey}: Size=${apptGroup.length}, isMultiple=${isMultiple}`);
        let message = "";
        
        if (!isMultiple) {
          const appt = firstAppt;
          const templateData = {
            customer_name: customer.name,
            barbershop_name: profile?.business_name || "Nossa Barbearia",
            service_name: appt.services?.name,
            professional_name: appt.barbers?.name,
            appointment_date: formatBrazilDate(appt.start_time),
            appointment_time: formatBrazilTime(appt.start_time),
            service_price: appt.final_amount && appt.final_amount > 0 ? `R$ ${appt.final_amount.toFixed(2).replace('.', ',')}` : "",
            appointment_id: appt.id
          };
          
          const rawTemplate = auto.template || `Olá {{customer_name}} 👋\n\nSeu agendamento na {{barbershop_name}} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {{service_name}}\n💈 Profissional: {{professional_name}}\n📅 Data: {{appointment_date}}\n⏰ Horário: {{appointment_time}}\n{{#if service_price}}💰 Valor: {{service_price}}{{/if}}\n\nO que deseja fazer?`;
          message = processAutomationTemplate(rawTemplate, templateData);
        } else {
          let appointmentsList = "";
          apptGroup.forEach((appt, i) => {
            appointmentsList += `${i + 1}️⃣ ${appt.services?.name}\n💈 ${appt.barbers?.name}\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n\n`;
          });

          const templateData = {
            customer_name: customer.name,
            barbershop_name: profile?.business_name || "Nossa Barbearia",
            appointments_list: appointmentsList.trim(),
            appointment_count: apptGroup.length
          };

          const rawTemplate = auto.template_multiple || `Olá {{customer_name}} 👋\n\nVocê possui {{appointment_count}} agendamentos na {{barbershop_name}}.\n\n📋 Resumo dos agendamentos:\n\n{{appointments_list}}\n\nO que deseja fazer?`;
          message = processAutomationTemplate(rawTemplate, templateData);
        }

        // Send via Z-API
        const connection = await getWhatsAppSettings(supabase, tenant_id);
        if (!connection) {
          const reason = "Sem conexão Z-API ativa";
          results.details.push(`Grupo ${groupKey}: ${reason}`);
          results.error_count += apptGroup.length;
          continue;
        }

        const buttons = [
          { id: "main_confirm", label: "Confirmar agendamento" },
          { id: "main_reschedule", label: "Reagendar" },
          { id: "main_cancel", label: "Cancelar" }
        ];

        // Validation before sending
        const forbiddenPhrases = [
          "Agendamento confirmado com sucesso",
          "Como deseja confirmar?",
          "Qual agendamento deseja confirmar?",
          "Você ainda possui outro agendamento pendente"
        ];
        
        if (!isMultiple) {
          forbiddenPhrases.push("Você possui mais de um agendamento");
        }

        const hasForbiddenPhrase = forbiddenPhrases.some(phrase => message.includes(phrase));
        const hasPlaceholders = containsPlaceholders(message);
        
        console.log(`[AutomationEngine] MESSAGE BEFORE SENDING to ${customer.phone}:`, message);
        
        // 2. PREPARAR/CRIAR CONVERSA ANTES DO ENVIO
        console.log('--- PREPARING CONVERSATION ---');
        
        // Desativar conversas anteriores para o mesmo telefone
        const { error: deactivateError } = await supabase.from("whatsapp_conversations")
          .update({ active: false })
          .eq("active", true)
          .or(`phone.eq.${normalizedPhoneValue},phone.eq.${fallbackPhoneValue},phone_fallback.eq.${normalizedPhoneValue},phone_fallback.eq.${fallbackPhoneValue}`);
          
        if (deactivateError) {
          console.log('[AutomationEngine] Warning: Could not deactivate previous conversations:', deactivateError.message);
        }

        // Upsert conversation
        const convPayload = {
          tenant_id: tenant_id,
          barber_id: tenant_id,
          customer_id: customer.id,
          phone: normalizedPhoneValue,
          phone_fallback: fallbackPhoneValue,
          state: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
          active: true,
          appointment_group_id: group_id,
          appointment_id: !isMultiple ? firstAppt.id : null,
          context: {
            appointment_ids: apptGroup.map(a => a.id),
            multiple: isMultiple
          },
          updated_at: new Date().toISOString()
        };

        // We use insert then check if we should have updated, but the user requested:
        // "NÃO usar upsert com onConflict se não houver unique."
        // We already deactivated previous ones, so we just insert a new one.
        const { data: newConv, error: convError } = await supabase
          .from("whatsapp_conversations")
          .insert(convPayload)
          .select()
          .single();

        if (convError) {
          console.error('CONVERSATION CREATE ERROR:', convError);
        } else {
          console.log('CONVERSATION CREATED:', newConv.id);
        }

        let sendResult = { success: false, error: "Validation failed", response: null };
        
        if (!hasPlaceholders && !hasForbiddenPhrase) {
          console.log('SENDING INITIAL CONFIRMATION');
          sendResult = await sendMessage(connection, customer.phone, message, { buttons });
        } else {
          console.error(`[AutomationEngine] Message validation failed. Placeholders=${hasPlaceholders}, Forbidden=${hasForbiddenPhrase}`);
          sendResult.error = `Validation failed: Placeholders=${hasPlaceholders}, Forbidden=${hasForbiddenPhrase}`;
        }
        
        // 3. Log to automation_logs
        await supabase.from("automation_logs").insert({
          tenant_id: tenant_id,
          barber_id: tenant_id,
          phone: normalizedPhoneValue,
          webhook_type: auto.type,
          direction: 'outgoing',
          status: sendResult.success ? 'success' : 'error',
          error_message: sendResult.error,
          message_sent: message,
          appointment_id: !isMultiple ? firstAppt.id : null,
          appointment_group_id: group_id,
          conversation_id: newConv?.id,
          zapi_response: sendResult.response,
          metadata: {
            has_placeholders: hasPlaceholders,
            appointments_count: apptGroup.length,
            is_multiple: isMultiple,
            conversation_id: newConv?.id,
            conversation_state: newConv?.state,
            conversation_active: newConv?.active
          }
        });

        if (sendResult.success) {
          results.processed_count += apptGroup.length;
          results.messages_sent.push({ phone: customer.phone, status: 'success' });
          
          // 4. Mark appointments only AFTER success
          await supabase.from("appointments")
            .update({ 
              confirmation_sent: true, 
              confirmation_sent_at: new Date().toISOString() 
            })
            .in("id", apptGroup.map(a => a.id));
            
          console.log('SUCCESS: Message sent and appointments marked.');
        } else {
          results.error_count += apptGroup.length;
          results.errors.push({ group: groupKey, error: sendResult.error });
          
          // If sending failed, maybe deactivate the conversation we just created?
          // User didn't specify, but usually better to keep it if they might reply anyway, 
          // but here we failed to even send the initial message.
          if (newConv) {
            await supabase.from("whatsapp_conversations").update({ active: false, error: sendResult.error }).eq("id", newConv.id);
          }
        }

      } catch (err: any) {
        console.error(`[AutomationEngine] Group ${groupKey} Error:`, err);
        results.error_count++;
        results.errors.push({ group: groupKey, error: err.message });
      }
    }

    // 6. Final Update to Cron Run
    await supabase.from("automation_cron_runs").update({
      status: results.error_count === 0 ? 'success' : 'error',
      finished_at: new Date().toISOString(),
      processed_count: results.processed_count,
      skipped_count: results.skipped_count,
      error_count: results.error_count,
      found_count: results.found_count,
      eligible_count: results.eligible_count,
      processed_appointments: all_details,
      errors: results.errors,
      details: { logs: results.details, ignored: results.ignoredRecords }
    }).eq('id', runId);

    return results;

  } catch (error: any) {
    console.error("[AutomationEngine] Fatal Error:", error);
    await supabase.from("automation_cron_runs").update({ 
      status: 'error', 
      finished_at: new Date().toISOString(),
      error: error.message,
      processed_appointments: all_details,
      details: { logs: results.details, fatal: error.stack }
    }).eq('id', runId);
    return { ...results, success: false, error: error.message };
  }
}

