
/**
 * Normalizes a phone number to E.164 format (digits only, including country code)
 * Example: "+55 (71) 99999-9999" -> "5571999999999"
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  
  let digits = phone.replace(/\D/g, "");
  
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
    
    // Regra: Se tiver apenas 8 dígitos após o DDD, adicionamos o 9 na frente.
    if (number.length === 8) {
      number = "9" + number;
    }
    
    return `${country}${ddd}${number}`;
  }
  
  return digits;
};

/**
 * Legacy mask formatter - kept for backward compatibility where needed,
 * but the new PhoneInput component should handle its own masking.
 */
export const formatPhoneMask = (value: string): string => {
  if (!value) return "";
  
  let cleaned = value.replace(/\D/g, "");
  
  // If it starts with 55, remove it for visual masking in some contexts
  if (cleaned.startsWith('55') && cleaned.length > 2) {
    cleaned = cleaned.substring(2);
  }
  
  const truncated = cleaned.slice(0, 11);
  
  if (truncated.length <= 2) {
    return truncated.length > 0 ? `(${truncated}` : "";
  } else if (truncated.length <= 6) {
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
  } else if (truncated.length <= 10) {
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
  } else {
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
  }
};

