import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export const Route = createFileRoute("/api/webhooks/zapi/$barbershopId")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          success: true,
          message: "Webhook online",
        });
      },
      POST: async ({ request, params }) => {
        try {
          const { barbershopId } = params;
          const body = await request.json();

          console.log("ZAPI WEBHOOK RECEIVED:", {
            barbershopId,
            eventType: body.type || body.event,
            body
          });

          // Save to webhook_logs using service role to bypass RLS
          const supabase = getSupabase();
          const { error } = await supabase.from("webhook_logs").insert({
            barbershop_id: barbershopId,
            payload: body,
            event_type: body.type || body.event || "zapi_event",
            status: 'received',
            created_at: new Date().toISOString(),
          });

          if (error) {
            console.error("Error saving webhook log:", error);
          }

          return Response.json({
            success: true,
            message: "Event received"
          });
        } catch (error) {
          console.error("Webhook processing failed:", error);
          return Response.json(
            {
              success: false,
              error: "Webhook processing failed",
            },
            {
              status: 500,
            }
          );
        }
      },
    },
  },
});
