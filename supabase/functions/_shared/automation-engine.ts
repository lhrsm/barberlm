import { formatAppointmentDateTimeForMessage, normalizePhone } from "./utils.ts";

export const AUTOMATION_STATES = {
  // Single flow states
  SINGLE_AWAITING_MAIN_ACTION: 'single.awaiting_main_action',
  SINGLE_COMPLETED: 'single.completed',
  
  // Multi flow states
  MULTI_AWAITING_MAIN_ACTION: 'multi.awaiting_main_action',
  MULTI_AWAITING_CONFIRM_SCOPE: 'multi.awaiting_confirm_scope',
  MULTI_AWAITING_SPECIFIC_SELECTION: 'multi.awaiting_specific_selection',
  MULTI_AWAITING_REMAINING_ACTION: 'multi.awaiting_remaining_action',
  MULTI_COMPLETED: 'multi.completed',
  
  // Shared/Legacy fallback
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const FLOW_TYPES = {
  SINGLE: 'single',
  MULTI: 'multi'
};

export interface AutomationResult {
  success: boolean;
  next_state?: string;
  message_to_send?: string;
  buttons?: any[];
  list?: any;
  action_executed?: string;
  error?: string;
}
