import { supabase } from "@/integrations/supabase/client";

export type AdminEventKey =
  | "tenant.signup"
  | "tenant.onboarding_completed"
  | "tenant.first_appointment"
  | "subscription.created"
  | "subscription.upgraded"
  | "subscription.cancelled"
  | "subscription.downgraded"
  | "subscription.payment_failed"
  | "trial.expiring_soon"
  | "tenant.inactive_7d"
  | "support.ticket_created"
  | "support.suggestion_created"
  | "support.ticket_urgent"
  | "payment.refund_requested"
  | "system.error_spike"
  | "whatsapp.instance_disconnected"
  | "revenue.milestone"
  | "payment.high_value";

export interface EmitAdminEventArgs {
  event_key: AdminEventKey;
  title: string;
  message?: string;
  severity?: "info" | "warning" | "critical";
  tenant_id?: string;
  action_url?: string;
  payload?: Record<string, unknown>;
}

/**
 * Fire an admin-facing event. Fans out to super admins across panel, push and
 * WhatsApp based on each admin's subscriptions. Fire-and-forget.
 */
export async function emitAdminEvent(args: EmitAdminEventArgs) {
  try {
    const { data, error } = await supabase.functions.invoke("emit-admin-event", { body: args });
    if (error) console.warn("[emitAdminEvent] error", args.event_key, error);
    return data;
  } catch (err) {
    console.warn("[emitAdminEvent] threw", args.event_key, err);
    return null;
  }
}
