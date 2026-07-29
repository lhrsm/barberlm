import { createFileRoute } from "@tanstack/react-router";
import { assertCronAuth } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron: every 30 min. Sends a WhatsApp reminder to CUSTOMERS who received a
 * review request 24h+ ago but haven't submitted their review yet.
 *
 * Rules:
 *  - Only sends to the customer (never to shop / barber).
 *  - Skips if a review was already submitted (submitted_at IS NOT NULL).
 *  - Skips if a reminder was already sent (reply_reminder_sent_at set).
 *  - One reminder per appointment, ever.
 */
export const Route = createFileRoute("/api/public/hooks/review-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = assertCronAuth(request);
        if (denied) return denied;

        const origin =
          process.env.PUBLIC_APP_URL?.replace(/\/$/, "") || "https://barbex.shop";
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(SUPABASE_URL, KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Reviews created (request sent) 24h+ ago, not yet submitted, no reminder yet.
        const { data: reviews, error } = await supabase
          .from("appointment_reviews")
          .select(
            "id, tenant_id, appointment_id, customer_id, review_token, created_at, submitted_at, reply_reminder_sent_at, customer:customers(name, phone)",
          )
          .is("submitted_at", null)
          .is("reply_reminder_sent_at", null)
          .not("review_token", "is", null)
          .lte("created_at", cutoff)
          .limit(100);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: any[] = [];
        for (const r of reviews || []) {
          const mark = async (reason: string, extra: Record<string, any> = {}) => {
            await supabase
              .from("appointment_reviews")
              .update({ reply_reminder_sent_at: new Date().toISOString() })
              .eq("id", r.id);
            results.push({ id: r.id, ok: true, skipped: reason === "sent" ? false : true, reason, ...extra });
          };

          try {
            // Double-check: customer really hasn't reviewed (any review row for this appointment/customer)
            const { data: anyReview } = await supabase
              .from("appointment_reviews")
              .select("id, submitted_at")
              .eq("appointment_id", r.appointment_id)
              .not("submitted_at", "is", null)
              .limit(1)
              .maybeSingle();
            if (anyReview) {
              await mark("review_already_submitted");
              continue;
            }

            const phoneRaw = (r as any).customer?.phone as string | undefined;
            const customerName = (r as any).customer?.name || "Cliente";
            if (!phoneRaw) {
              await mark("no_phone");
              continue;
            }

            const { data: instance } = await supabase
              .from("whatsapp_instances")
              .select("*")
              .eq("tenant_id", r.tenant_id)
              .maybeSingle();
            if (!instance?.instance_id || !instance?.token) {
              await mark("no_whatsapp_instance");
              continue;
            }

            const { data: tenant } = await supabase
              .from("profiles")
              .select("business_name")
              .eq("id", r.tenant_id)
              .maybeSingle();

            const reviewLink = `${origin}/review/${r.review_token}`;
            const message =
              `Olá ${customerName}! 👋\n\n` +
              `Percebemos que você ainda não avaliou seu atendimento na *${tenant?.business_name || "nossa barbearia"}*.\n\n` +
              `Sua opinião é muito importante para nós. Leva menos de 30 segundos! ✨\n\n` +
              `⭐ Avaliar agora:\n${reviewLink}\n\n` +
              `Obrigado! 🙏`;

            let phone = phoneRaw.replace(/\D/g, "");
            if (phone.length === 10 || phone.length === 11) phone = "55" + phone;

            const baseUrl = instance.server_url || "https://api.z-api.io";
            const sendUrl = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/send-text`;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (instance.client_token) headers["Client-Token"] = instance.client_token;

            const resp = await fetch(sendUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({ phone, message }),
            });

            if (!resp.ok) {
              const body = await resp.json().catch(() => ({}));
              results.push({ id: r.id, ok: false, error: body?.message || `HTTP ${resp.status}` });
              continue;
            }

            await mark("sent");
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
