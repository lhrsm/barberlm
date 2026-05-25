import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client lazily
let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );
  }
  return _supabase;
}

export const Route = createFileRoute("/api/webhooks/zapi/$barbershopId")({
  component: () => "OK",
  server: {
    handlers: {
      GET: async () => {
        console.log("Z-API Webhook GET ping received");
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
        console.log(`Z-API Webhook POST received for ${barbershopId}`);

        try {
          // Clone request to avoid body usage issues if needed, 
          // though in standard handlers it should be fine.
          const body = await request.json();
          console.log("Z-API Body parsed successfully");

          // Save log without awaiting it too long if possible, 
          // but for now let's just do it simply.
          const supabase = getSupabase();
          
          // We use a try-catch specifically for the DB insert to avoid hanging the whole webhook
          try {
            const { error: logError } = await supabase
              .from("webhook_logs")
              .insert({
                barbershop_id: barbershopId,
                payload: body,
                created_at: new Date().toISOString(),
              });

            if (logError) console.error("Supabase Log Error:", logError);
          } catch (dbError) {
            console.error("Database connection error:", dbError);
          }

          return new Response(
            JSON.stringify({ success: true }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("Webhook processing error:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Processing failed" }),
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
