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
  let digits = phone.replace(/\D/g, "");
  // Se tiver 10 ou 11 dígitos, assume que falta o DDI 55
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}
