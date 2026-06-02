import { formatBrazilDate, formatBrazilTime } from "./utils.ts";

export function processAutomationTemplate(template: string, data: Record<string, any>): string {
  if (!template) return "";
  
  // Mapping of user-requested variables to real data
  // Using both Portuguese and English variations as requested/standardized
  const variables: Record<string, string> = {
    customer_name: data.customer_name || data.cliente_nome || "Cliente",
    cliente_nome: data.customer_name || data.cliente_nome || "Cliente",
    
    barbershop_name: data.barbershop_name || data.barbearia_nome || data.business_name || "Barbearia",
    barbearia_nome: data.barbershop_name || data.barbearia_nome || data.business_name || "Barbearia",
    
    service_name: data.service_name || data.servico || "Serviço não informado",
    servico: data.service_name || data.servico || "Serviço não informado",
    
    professional_name: data.professional_name || data.profissional || "Profissional não informado",
    profissional: data.professional_name || data.profissional || "Profissional não informado",
    
    appointment_date: data.appointment_date || data.data || "",
    data: data.appointment_date || data.data || "",
    
    appointment_time: data.appointment_time || data.horario || "",
    horario: data.appointment_time || data.horario || "",
    
    service_price: data.service_price || data.valor || "R$ 0,00",
    valor: data.service_price || data.valor || "R$ 0,00",
    
    appointments_list: data.appointments_list || "",
    link_agendamento: data.link_agendamento || "",
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value || "");
  }

  // Protection: If message still contains placeholders, log it but it's better to catch it in the caller
  return result;
}

export function containsPlaceholders(text: string): boolean {
  return /{{[a-zA-Z0-9_]+}}/.test(text);
}
