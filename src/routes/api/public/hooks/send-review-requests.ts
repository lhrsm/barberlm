import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron endpoint: sends a WhatsApp review request for appointments completed
 * more than 15 minutes ago that haven't received a review link yet.
 * Called every 5 minutes by pg_cron.
 */
export const Route = createFileRoute("/api/public/hooks/send-review-requests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Public origin for review links. The cron calls this endpoint via the
        // stable `project--<id>.lovable.app` URL, but that host serves 403
        // ("Forbidden") for non /api/public/* routes. Use the published app
        // domain so customers can actually open the link.
        const origin =
          process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
          "https://barbex.shop";

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        // Find completed appointments not yet dispatched
        const { data: appts, error } = await supabase
          .from("appointments")
          .select(
            "id, tenant_id, customer_id, barber_id, service_id, start_time, completed_at, status",
          )
          .eq("status", "completed")
          .not("customer_id", "is", null)
          .lte("completed_at", cutoff)
          .limit(50);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: any[] = [];

        for (const appt of appts || []) {
          try {
            // Idempotency: skip if we already logged (sent/skipped)
            const { data: existingLog } = await supabase
              .from("review_automation_logs")
              .select("id")
              .eq("appointment_id", appt.id)
              .in("status", ["sent", "skipped"])
              .maybeSingle();
            if (existingLog) continue;

            // Skip if already reviewed
            const { data: existingReview } = await supabase
              .from("appointment_reviews")
              .select("id, submitted_at")
              .eq("appointment_id", appt.id)
              .maybeSingle();
            if (existingReview?.submitted_at) {
              await supabase.from("review_automation_logs").insert({
                tenant_id: appt.tenant_id,
                appointment_id: appt.id,
                customer_id: appt.customer_id,
                status: "skipped",
                reason: "already_submitted",
              });
              continue;
            }

            // Load related data
            const [{ data: customer }, { data: tenant }, { data: barber }, { data: service }, { data: instance }, { data: mod }] =
              await Promise.all([
                supabase.from("customers").select("id, name, phone").eq("id", appt.customer_id).maybeSingle(),
                supabase.from("profiles").select("id, business_name, slug").eq("id", appt.tenant_id).maybeSingle(),
                appt.barber_id
                  ? supabase.from("barbers").select("id, name").eq("id", appt.barber_id).maybeSingle()
                  : Promise.resolve({ data: null } as any),
                appt.service_id
                  ? supabase.from("services").select("id, name").eq("id", appt.service_id).maybeSingle()
                  : Promise.resolve({ data: null } as any),
                supabase.from("whatsapp_instances").select("*").eq("tenant_id", appt.tenant_id).maybeSingle(),
                supabase
                  .from("barbershop_modules")
                  .select("enabled")
                  .eq("tenant_id", appt.tenant_id)
                  .eq("module_key", "whatsapp")
                  .maybeSingle(),
              ]);

            if (!customer?.phone) {
              await supabase.from("review_automation_logs").insert({
                tenant_id: appt.tenant_id,
                appointment_id: appt.id,
                customer_id: appt.customer_id,
                status: "skipped",
                reason: "no_phone",
              });
              continue;
            }

            if (!instance || !instance.instance_id || !instance.token) {
              await supabase.from("review_automation_logs").insert({
                tenant_id: appt.tenant_id,
                appointment_id: appt.id,
                customer_id: appt.customer_id,
                status: "skipped",
                reason: "no_whatsapp_instance",
              });
              continue;
            }

            if (mod && mod.enabled === false) {
              await supabase.from("review_automation_logs").insert({
                tenant_id: appt.tenant_id,
                appointment_id: appt.id,
                customer_id: appt.customer_id,
                status: "skipped",
                reason: "whatsapp_module_disabled",
              });
              continue;
            }

            // Load template
            const { data: tpl } = await supabase
              .from("automation_templates")
              .select("template, active")
              .eq("tenant_id", appt.tenant_id)
              .eq("key", "post_service_review")
              .maybeSingle();

            if (tpl && tpl.active === false) {
              await supabase.from("review_automation_logs").insert({
                tenant_id: appt.tenant_id,
                appointment_id: appt.id,
                customer_id: appt.customer_id,
                status: "skipped",
                reason: "automation_disabled",
              });
              continue;
            }

            const defaultTemplate =
              "Olá {{customer_name}}! ✨\n\nEsperamos que tenha gostado do seu atendimento na *{{barbershop_name}}*.\n\nSua opinião é muito importante para nós. Poderia dedicar 30 segundos para avaliar o serviço?\n\n👉 {{review_link}}\n\nMuito obrigado! 🙏";
            const template = tpl?.template || defaultTemplate;

            // Create the review row + token
            const token = crypto.randomUUID();
            const { data: reviewRow, error: revErr } = await supabase
              .from("appointment_reviews")
              .upsert(
                {
                  tenant_id: appt.tenant_id,
                  appointment_id: appt.id,
                  customer_id: appt.customer_id,
                  barber_id: appt.barber_id,
                  review_token: token,
                  token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  testimonial_status: "pending",
                  show_on_frontend: false,
                },
                { onConflict: "appointment_id" },
              )
              .select("id, review_token")
              .single();

            if (revErr || !reviewRow) {
              await supabase.from("review_automation_logs").insert({
                tenant_id: appt.tenant_id,
                appointment_id: appt.id,
                customer_id: appt.customer_id,
                status: "failed",
                error_message: revErr?.message || "review_insert_failed",
              });
              continue;
            }

            const reviewLink = `${origin}/review/${reviewRow.review_token}`;
            const apptDate = new Date(appt.start_time).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const message = template
              .replace(/\{\{?\s*customer_name\s*\}?\}/g, customer.name || "Cliente")
              .replace(/\{\{?\s*barbershop_name\s*\}?\}/g, tenant?.business_name || "Barbearia")
              .replace(/\{\{?\s*barber_name\s*\}?\}/g, barber?.name || "")
              .replace(/\{\{?\s*service_name\s*\}?\}/g, service?.name || "")
              .replace(/\{\{?\s*appointment_date\s*\}?\}/g, apptDate)
              .replace(/\{\{?\s*review_link\s*\}?\}/g, reviewLink);

            // Send via Z-API
            let phone = customer.phone.replace(/\D/g, "");
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
            const respBody = await resp.json().catch(() => ({}));

            if (!resp.ok) {
              await supabase.from("review_automation_logs").insert({
                tenant_id: appt.tenant_id,
                appointment_id: appt.id,
                customer_id: appt.customer_id,
                review_id: reviewRow.id,
                status: "failed",
                error_message: respBody?.message || respBody?.error || `HTTP ${resp.status}`,
              });
              results.push({ appointment_id: appt.id, status: "failed" });
              continue;
            }

            await supabase.from("review_automation_logs").insert({
              tenant_id: appt.tenant_id,
              appointment_id: appt.id,
              customer_id: appt.customer_id,
              review_id: reviewRow.id,
              status: "sent",
              provider_message_id: respBody?.messageId || respBody?.id || null,
            });
            results.push({ appointment_id: appt.id, status: "sent" });
          } catch (err: any) {
            await supabase.from("review_automation_logs").insert({
              tenant_id: appt.tenant_id,
              appointment_id: appt.id,
              customer_id: appt.customer_id,
              status: "failed",
              error_message: err?.message || String(err),
            });
            results.push({ appointment_id: appt.id, status: "failed", error: err?.message });
          }
        }

        return new Response(
          JSON.stringify({ processed: results.length, results }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
