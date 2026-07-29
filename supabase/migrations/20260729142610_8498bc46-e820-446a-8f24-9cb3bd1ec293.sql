REVOKE SELECT ON public.appointments FROM anon;

GRANT SELECT (
  id, user_id, customer_id, barber_id, service_id, start_time, end_time, status,
  total_price, notes, created_at, payment_status, payment_method, items,
  refund_requested_at, refund_type, refund_status, original_total, credit_used,
  pix_amount, barbershop_amount, final_amount, cashback_used, cashback_earned,
  reminder_sent, confirmation_sent, tenant_id, source, updated_by_type, updated_by_id,
  coupon_id, coupon_code, discount_amount, subtotal_amount, appointment_group_id,
  cancel_reason, confirmation_sent_at, reminder_sent_at, updated_at, completed_at,
  confirmed_at, cancelled_at, cancel_source, cancelled_by, confirmed_by, completed_by,
  refund_preference, credits_used, amount_paid, confirmation_response_sent_at,
  cash_amount, credit_card_amount, debit_card_amount, payment_breakdown,
  customer_action_source, rescheduled_from_id, payment_id, service_amount,
  group_sequence, paid_at, subscription_id, subscription_plan_id,
  subscription_covered_amount, extra_amount, tip_amount, products_amount,
  tip_barber_id, appointment_type, walkin_arrived_at, walkin_started_at,
  walkin_ticket_number
) ON public.appointments TO anon;