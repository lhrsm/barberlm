
/**
 * Normalizes a phone number by removing non-numeric characters
 * and ensuring it has the '55' country code for Brazil.
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, "");
  
  if (digits.startsWith('55')) {
    return digits;
  }

  return `55${digits}`;
};

/**
 * Formats a numeric string into a Brazilian phone mask: (XX) XXXXX-XXXX
 */
export const formatPhoneMask = (value: string): string => {
  if (!value) return "";
  
  // Remove all non-numeric characters
  const cleaned = value.replace(/\D/g, "");
  
  // Limit to 11 digits (Brazilian mobile)
  const truncated = cleaned.slice(0, 11);
  
  if (truncated.length <= 2) {
    return truncated.length > 0 ? `(${truncated}` : "";
  } else if (truncated.length <= 6) {
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
  } else if (truncated.length <= 10) {
    // Landline format (XX) XXXX-XXXX
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
  } else {
    // Mobile format (XX) XXXXX-XXXX
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
  }
};
