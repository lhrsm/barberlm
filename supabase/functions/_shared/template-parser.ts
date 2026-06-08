import { formatBrazilDate, formatBrazilTime } from "./utils.ts";

export function processAutomationTemplate(template: string, data: Record<string, any>): string {
  if (!template) return "";
  
  let result = template;

  // 1. Handle Conditional Blocks: {{#if variable}}...{{/if}} or {#if variable}...{/if}
  const ifRegex = /{{?\s*#if\s+([a-zA-Z0-9_]+)\s*}}?(.*?){{?\s*\/if\s*}}?/gs;
  result = result.replace(ifRegex, (match, variable, content) => {
    const value = data[variable];
    const isTruthy = value && 
                     value !== "R$ 0,00" && 
                     value !== "0,00" && 
                     value !== "" && 
                     value !== "false" && 
                     value !== false;
                     
    if (isTruthy) {
      return content;
    }
    return "";
  });

  // 2. Mapping of variables to real data
  const variables: Record<string, any> = {
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
    
    service_price: data.service_price || data.valor || "",
    valor: data.service_price || data.valor || "",
    
    management_link: data.management_link || data.link_agendamento || "",
    link_agendamento: data.management_link || data.link_agendamento || "",
    
    appointments_list: data.appointments_list || "",
    appointment_id: data.appointment_id || "",
    management_token: data.management_token || "",
  };

  // 3. Replace placeholders: {{variable}} or {variable}
  for (const [key, value] of Object.entries(variables)) {
    // Match {{ key }} or { key }
    const placeholderRegex = new RegExp(`{{?\\s*${key}\\s*}}?`, 'g');
    const stringValue = String(value || "");
    result = result.replace(placeholderRegex, stringValue);
  }

  // 4. Final Cleanup: Remove any remaining Handlebars tags
  result = result.replace(/{{?\s*[#\/]?[a-zA-Z0-9_ ]+\s*}}?/g, "");

  return result.trim();
}

export function containsPlaceholders(text: string): boolean {
  // Checks for both {variable} and {{variable}}
  return /{[#\/]?[a-zA-Z0-9_ ]+}/.test(text) || /{{[#\/]?[a-zA-Z0-9_ ]+}}/.test(text);
}

export function getMissingPlaceholders(text: string): string[] {
  const matches = text.match(/{[a-zA-Z0-9_]+}/g) || [];
  const doubleMatches = text.match(/{{[a-zA-Z0-9_]+}}/g) || [];
  return [...new Set([...matches, ...doubleMatches])];
}
