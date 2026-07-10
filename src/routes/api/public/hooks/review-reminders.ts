import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron: every 30 min. Finds reviews submitted more than 24h ago that still
 * have no reply from the shop and fires an internal `review.pending_reply`
 * event so recepção/gerente get a reminder. Sends at most ONE reminder per
 * review (tracked via `reply_reminder_sent_at`).
 */
export const Route = createFileRoute("/api/public/hooks/review-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(SUPABASE_URL, KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: reviews, error } = await supabase
          .from("appointment_reviews")
          .select("id, tenant_id, appointment_id, customer_id, barbershop_rating, barber_rating, service_rating, testimonial_text, submitted_at, reply, reply_reminder_sent_at, customer:customers(name)")
          .not("submitted_at", "is", null)
          .is("reply", null)
          .is("reply_reminder_sent_at", null)
          .lte("submitted_at", cutoff)
          .limit(100);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: any[] = [];
        for (const r of reviews || []) {
          const ratings = [r.barbershop_rating, r.barber_rating, r.service_rating].filter((n) => typeof n === "number") as number[];
          const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
          try {
            await supabase.functions.invoke("emit-automation-event", {
              body: {
                tenant_id: r.tenant_id,
                event: "review.pending_reply",
                appointment_id: r.appointment_id,
                customer_id: r.customer_id,
                extra: {
                  review_id: r.id,
                  avg_rating: avg.toFixed(1),
                  testimonial: r.testimonial_text || "",
                  customer_name: (r as any).customer?.name || "",
                  hours_pending: Math.round((Date.now() - new Date(r.submitted_at!).getTime()) / 3600000),
                },
              },
            });
            await supabase
              .from("appointment_reviews")
              .update({ reply_reminder_sent_at: new Date().toISOString() })
              .eq("id", r.id);
            results.push({ id: r.id, ok: true });
          } catch (e: any) {
            results.push({ id: r.id, ok: false, error: e.message });
          }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
