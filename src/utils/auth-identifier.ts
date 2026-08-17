import { normalizePhone } from "./phone";

export type IdentifierType = 'email' | 'phone';

export interface NormalizedIdentifier {
  type: IdentifierType;
  value: string;
}

/**
 * Detects if the identifier is an email or a phone number and normalizes it.
 */
export const normalizeIdentifier = (identifier: string): NormalizedIdentifier => {
  const trimmed = identifier.trim();
  
  // Rule: If it contains any letter or @, it's treated as potential email
  if (/[a-zA-Z@]/.test(trimmed)) {
    return {
      type: 'email',
      value: trimmed.toLowerCase()
    };
  }
  
  // Rule: If it contains only digits and allowed mask characters, it's treated as phone
  const phoneDigits = trimmed.replace(/[^\d+()-\s]/g, "");
  if (phoneDigits.length > 0 && phoneDigits === trimmed) {
    return {
      type: 'phone',
      value: normalizePhone(trimmed)
    };
  }
  
  // Default fallback (treat as email for typing purposes)
  return {
    type: 'email',
    value: trimmed.toLowerCase()
  };
};
