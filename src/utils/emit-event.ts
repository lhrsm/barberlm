import { supabase } from "@/integrations/supabase/client";

export type AutomationEvent =
  | "appointment.created"
  | "appointment.confirmed"
  | "appointment.cancelled.by_customer"
  | "appointment.cancelled.by_barber"
  | "appointment.cancelled.by_shop"
  | "appointment.rescheduled.by_customer"
  | "appointment.rescheduled.by_barber"
  | "appointment.rescheduled.by_shop"
  | "appointment.professional_changed"
  | "appointment.started"
  | "appointment.completed"
  | "payment.confirmed"
  | "cashback.received"
  | "credits.received"
  | "subscription.created"
  | "subscription.cancelled"
  | "subscription.renewed"
  | "subscription.renewal_failed"
  | "loyalty.reward_unlocked";

export interface EmitEventArgs {
  tenantId: string;
  event: AutomationEvent;
  appointmentId?: string;
  customerId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Fire an automation event. The edge function fans it out to every active
 * template (customer/barber/shop) configured for this event by the tenant.
 * Fire-and-forget: errors are logged, never thrown.
 */
export async function emitAutomationEvent({ tenantId, event, appointmentId, customerId, extra }: EmitEventArgs) {
  try {
    const { data, error } = await supabase.functions.invoke("emit-automation-event", {
      body: {
        tenant_id: tenantId,
        event,
        appointment_id: appointmentId,
        customer_id: customerId,
        extra,
      },
    });
    if (error) console.warn("[emitAutomationEvent] error", event, error);
    return data;
  } catch (err) {
    console.warn("[emitAutomationEvent] threw", event, err);
    return null;
  }
}
