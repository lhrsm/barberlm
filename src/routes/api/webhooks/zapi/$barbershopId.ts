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
            eventType: body.type,
            body
          });

          const supabase = getSupabase();
          const { type, instanceId } = body;

          // 1. Save Log
          const { error: logError } = await supabase.from("webhook_logs").insert({
            barbershop_id: barbershopId,
            payload: body,
            event_type: type || "unknown",
            status: 'received',
            created_at: new Date().toISOString(),
          });

          if (logError) console.error("Error saving webhook log:", logError);

          // 2. Process Business Logic based on Event Type
          switch (type) {
            case "ReceivedMessage": {
              const message = body.text?.message || body.image?.caption || body.video?.caption || "Mensagem recebida";
              const from = body.phone;

              await supabase.from("whatsapp_messages").insert({
                user_id: barbershopId, // Assumes user_id can be barbershopId or linked
                barbershop_id: barbershopId,
                content: message,
                status: 'received',
                metadata: { phone: from, raw: body }
              });
              break;
            }
            case "Connected": {
              await supabase
                .from("whatsapp_connections")
                .update({ 
                  status: 'connected', 
                  updated_at: new Date().toISOString(),
                  phone: body.phone
                })
                .eq("barbershop_id", barbershopId);
              break;
            }
            case "Disconnected": {
              await supabase
                .from("whatsapp_connections")
                .update({ 
                  status: 'disconnected', 
                  updated_at: new Date().toISOString() 
                })
                .eq("barbershop_id", barbershopId);
              break;
            }
          }

          return Response.json({
            success: true,
            message: "Event processed"
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
