export function processAutomationTemplate(template: string, data: Record<string, any>): string {
  if (!template) return "";
  
  const variables: Record<string, string> = {
    cliente_nome: data.cliente_nome || data.customer_name || "Cliente",
    barbearia_nome: data.barbearia_nome || data.business_name || "Nossa Barbearia",
    data: data.data || data.appointment_date || "",
    horario: data.horario || data.appointment_time || "",
    profissional: data.profissional || data.barber_name || "Seu Profissional",
    servico: data.servico || data.service_name || "Serviço",
    link_agendamento: data.link_agendamento || "",
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value || "");
  }

  return result;
}
