import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client lazily
const getSupabase = () => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
};

export const Route = createFileRoute("/api/webhooks/zapi/$barbershopId")({
  component: () => "Webhook Active",
  server: {
    handlers: {
      GET: async () => {
        console.log("[Z-API] GET ping received");
        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook online",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
      POST: async ({ request, params }) => {
        const { barbershopId } = params;
        console.log(`[Z-API] POST received for ${barbershopId}`);

        try {
          const body = await request.json().catch(() => null);

          if (!body) {
            return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Extract event type if available
          const eventType = body.type || "unknown";

          // Save to Supabase
          try {
            const supabase = getSupabase();
            const { error: logError } = await supabase
              .from("webhook_logs")
              .insert({
                barbershop_id: barbershopId,
                payload: body,
                event_type: eventType,
                status: "received",
                created_at: new Date().toISOString(),
              });

            if (logError) {
              console.error("[Z-API] Supabase Error:", logError.message);
            }
          } catch (dbErr) {
            console.error("[Z-API] DB Connection Error:", dbErr);
          }

          return new Response(
            JSON.stringify({ success: true }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("[Z-API] Webhook Processing Failed:", error);
          return new Response(
            JSON.stringify({ success: false }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
