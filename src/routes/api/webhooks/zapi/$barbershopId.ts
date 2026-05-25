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
        console.log("Z-API Webhook GET check received");
        return Response.json({
          success: true,
          message: "Webhook online",
        });
      },
      POST: async ({ request, params }) => {
        try {
          const { barbershopId } = params;
          console.log(`Z-API Webhook POST received for barbershop: ${barbershopId}`);
          
          let body;
          try {
            body = await request.json();
          } catch (e) {
            console.error("Error parsing webhook body:", e);
            return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
          }

          console.log("Z-API Payload:", JSON.stringify(body, null, 2));

          // Save to Supabase asynchronously - don't await it if it's risky, 
          // but user wants it saved. Let's do it and ensure it has a timeout or catch.
          const supabase = getSupabase();
          
          // Log the event to webhook_logs
          const { error: logError } = await supabase
            .from('webhook_logs')
            .insert({
              barbershop_id: barbershopId,
              payload: body,
              created_at: new Date().toISOString()
            });

          if (logError) {
            console.error("Error saving webhook log to Supabase:", logError);
          }

          // Return success immediately to Z-API
          return Response.json({
            success: true
          });

        } catch (error) {
          console.error("Z-API Webhook Error:", error);
          return Response.json(
            {
              success: false,
              message: "Internal server error"
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
