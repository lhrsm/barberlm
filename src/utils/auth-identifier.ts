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
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (emailRegex.test(trimmed)) {
    return {
      type: 'email',
      value: trimmed.toLowerCase()
    };
  }
  
  // Otherwise, treat as phone
  return {
    type: 'phone',
    value: normalizePhone(trimmed)
  };
};
