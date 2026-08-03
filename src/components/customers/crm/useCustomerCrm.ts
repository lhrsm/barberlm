import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerCrmData {
  cashback: any[];
  creditTx: any[];
  credits: any[];
  reviews: any[];
  automations: any[];
  usage: any[];
  interactions: any[];
  tasks: any[];
}

const EMPTY: CustomerCrmData = {
  cashback: [],
  creditTx: [],
  credits: [],
  reviews: [],
  automations: [],
  usage: [],
};

/**
 * Lazily loads the complementary CRM datasets for a customer.
 * Read-only: does not change any business rule.
 */
export function useCustomerCrm(customerId: string | null, enabled: boolean) {
  const [data, setData] = useState<CustomerCrmData>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!customerId || !enabled) {
      setData(EMPTY);
      return;
    }
    setLoading(true);

    (async () => {
      const [cashback, creditTx, credits, reviews, automations, usage] = await Promise.all([
        supabase
          .from("cashback_transactions")
          .select("id, type, amount, base_amount, description, created_at, appointment_id")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("credit_transactions")
          .select("id, type, amount, description, created_at, appointment_id")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_credits")
          .select("id, amount, used_amount, available_amount, status, credit_type, expires_at, description, created_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("appointment_reviews")
          .select(
            "id, barbershop_rating, barber_rating, service_rating, testimonial_text, testimonial_status, reply, reply_at, created_at, submitted_at, would_recommend",
          )
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("automation_logs")
          .select("id, message_type, status, provider, phone, direction, sent_at, created_at, error_message, action")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("subscription_usage_logs")
          .select("id, used_at, benefit_type, benefit_key, covered_amount, extra_amount, consume_quantity, status")
          .eq("customer_id", customerId)
          .order("used_at", { ascending: false })
          .limit(100),
      ]);

      if (cancelled) return;
      setData({
        cashback: cashback.data || [],
        creditTx: creditTx.data || [],
        credits: credits.data || [],
        reviews: reviews.data || [],
        automations: automations.data || [],
        usage: usage.data || [],
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, enabled]);

  return { ...data, loading };
}
