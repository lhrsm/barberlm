import { formatInTimeZone, toDate } from "https://esm.sh/date-fns-tz@3.2.0";
import { ptBR } from "https://esm.sh/date-fns@4.3.0/locale";

const BRAZIL_TZ = "America/Sao_Paulo";

/**
 * Formata uma data para o timezone de Brasília (America/Sao_Paulo)
 * @param date Data em UTC (Date, string ISO, ou timestamp)
 * @param formatStr Formato desejado (default: 'dd/MM/yyyy HH:mm')
 */
export function formatBrazilDateTime(date: Date | string | number, formatStr: string = "dd/MM/yyyy HH:mm"): string {
  try {
    const d = typeof date === 'string' ? toDate(date) : date;
    return formatInTimeZone(d, BRAZIL_TZ, formatStr, { locale: ptBR });
  } catch (error) {
    console.error("Erro ao formatar data Brasil:", error, date);
    return String(date);
  }
}

/**
 * Retorna apenas a hora formatada no timezone de Brasília
 */
export function formatBrazilTime(date: Date | string | number): string {
  return formatBrazilDateTime(date, "HH:mm");
}

/**
 * Retorna apenas a data formatada no timezone de Brasília
 */
export function formatBrazilDate(date: Date | string | number): string {
  return formatBrazilDateTime(date, "dd/MM/yyyy");
}

/**
 * Retorna o dia e mês formatados no timezone de Brasília
 */
export function formatBrazilDayMonth(date: Date | string | number): string {
  return formatBrazilDateTime(date, "dd/MM");
}

/**
 * Retorna a data atual no timezone de Brasília
 */
export function getNowBrazil(): Date {
  return toDate(new Date(), { timeZone: BRAZIL_TZ });
}

export function normalizePhone(phone: string): string {
  if (!phone) return "";
  
  let digits = String(phone).replace(/\D/g, "");
  
  // Se não começar com 55, tenta identificar se é um número brasileiro sem DDI
  if (!digits.startsWith('55')) {
    // Se tiver 10 ou 11 dígitos, assume que falta o DDI 55
    if (digits.length === 10 || digits.length === 11) {
      digits = "55" + digits;
    }
  }
  
  // Tratamento específico para Brasil (DDI 55)
  if (digits.startsWith('55')) {
    const country = digits.slice(0, 2); // 55
    const ddd = digits.slice(2, 4);     // DDD
    let number = digits.slice(4);       // O resto do número
    
    // Regra: Se for celular (número começa com 7, 8 ou 9, ou conforme necessidade) 
    // e tiver apenas 8 dígitos após o DDD, adicionamos o 9 na frente.
    // Como o BarberLM usa WhatsApp, quase sempre tratamos como celular.
    if (number.length === 8) {
      number = "9" + number;
    }
    
    return `${country}${ddd}${number}`;
  }
  
  return digits;
}

/**
 * Remove o nono dígito de um número brasileiro (DDI 55 + DDD + 9 dígitos)
 * Retorna o número com 8 dígitos após o DDD.
 */
export function removeNinthDigit(phone: string): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  
  // Apenas se for Brasil e tiver 13 dígitos (55 + DDD + 9 dígitos)
  if (digits.startsWith('55') && digits.length === 13) {
    const country = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const number = digits.slice(5); // Pula o primeiro dígito do número (o nono dígito)
    return `${country}${ddd}${number}`;
  }
  
  return digits;
}

/**
 * Formata os dados de um agendamento para exibição em mensagens de WhatsApp.
 * Garante o uso do timezone America/Sao_Paulo.
 */
export function formatAppointmentDateTimeForMessage(appointment: any) {
  if (!appointment || !appointment.start_time) {
    return {
      date: "Data não definida",
      time: "Horário não definido"
    };
  }

  const date = formatBrazilDate(appointment.start_time);
  const time = formatBrazilTime(appointment.start_time);

  console.log(`[Utils] Formatting appointment ${appointment.id}: ${appointment.start_time} -> ${date} ${time} (America/Sao_Paulo)`);

  return { date, time };
}
