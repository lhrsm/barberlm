
export const AUTOMATION_V2_STATES = {
  SINGLE_AWAITING_MAIN_ACTION: 'single.awaiting_main_action',
  SINGLE_COMPLETED: 'single.completed',
  SINGLE_CANCELLED: 'single.cancelled',
  SINGLE_FAILED: 'single.failed',
  
  MULTI_AWAITING_MAIN_ACTION: 'multi.awaiting_main_action',
  MULTI_AWAITING_CONFIRM_SCOPE: 'multi.awaiting_confirm_scope',
  MULTI_AWAITING_CONFIRM_SPECIFIC: 'multi.awaiting_confirm_specific',
  MULTI_AWAITING_REMAINING_ACTION: 'multi.awaiting_remaining_action',
  MULTI_COMPLETED: 'multi.completed',
  MULTI_CANCELLED: 'multi.cancelled',
  MULTI_FAILED: 'multi.failed'
};

export const FLOW_TYPES = {
  SINGLE: 'single',
  MULTI: 'multi'
};
