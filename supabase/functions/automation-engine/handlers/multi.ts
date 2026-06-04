import { AUTOMATION_STATES, FLOW_TYPES } from "../../_shared/automation-engine.ts";
import { normalizePhone } from "../../_shared/utils.ts";
import { getWhatsAppSettings } from "../../_shared/whatsapp-settings.ts";

export async function processMultiAppointmentAutomation(supabase: any, item: any, workflow: any) {
  const tenantId = item.tenant_id;
  const groupId = item.appointment_group_id;

  if (!groupId) throw new Error("Missing appointment_group_id for multi flow");

  // 1. Fetch group data
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*, customers(*), services(name), barbers(name), profiles:tenant_id(business_name)")
    .eq("appointment_group_id", groupId)
    .order("start_time", { ascending: true });

  if (error || !appointments || appointments.length === 0) throw new Error(`Group not found: ${groupId}`);
  
  const mainAppointment = appointments[0];
  const customer = mainAppointment.customers;
  if (!customer?.phone) throw new Error("Customer phone not found");
  const normalizedPhone = normalizePhone(customer.phone);

  // 2. DETECÇÃO E LOGS DETALHADOS (SOLICITADO PELO USUÁRIO)
  const appointmentsCount = appointments.length;
  console.log(`[MultiFlow] Detected ${appointmentsCount} appointments for group ${groupId}`);

  // TEMPORARIAMENTE DESABILITADO conforme solicitado
  console.warn(`[MultiFlow] Multi flow is temporarily DISABLED by request.`);
  
  // Registrar log detalhado mesmo desabilitado
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    queue_id: item.id,
    flow_type: FLOW_TYPES.MULTI,
    action: "multi_flow_disabled",
    status: "info",
    message: `Fluxo Múltiplo ignorado (Desabilitado Temporariamente). Encontrados ${appointmentsCount} agendamentos.`,
    appointments_found: appointmentsCount,
    appointment_group_id: groupId,
    flow_type_selected: 'multi',
    reason_selected: 'group_contains_multiple_appointments'
  });

  // Retornar sucesso para não deixar o item travado na fila como erro,
  // mas não enviar mensagem.
  return { 
    success: true, 
    message: "Multi flow temporarily disabled",
    appointments_found: appointmentsCount 
  };
}
