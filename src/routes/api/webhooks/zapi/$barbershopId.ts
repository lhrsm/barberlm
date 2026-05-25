import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client lazily with fallback
const getSupabase = () => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    console.warn("Supabase credentials missing in server context");
  }
  return createClient(url, key);
};

export const Route = createFileRoute("/api/webhooks/zapi/$barbershopId")({
  // Adding a component just in case the router expects one for GET requests in the browser
  component: () => "Webhook Active",
  server: {
    handlers: {
      GET: async () => {
        console.log("[Z-API] GET request received");
        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook online",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      },
      POST: async ({ request, params }) => {
        const { barbershopId } = params;
        console.log(`[Z-API] POST received for barbershop: ${barbershopId}`);

        try {
          // 1. Parse body with timeout/safety
          const body = await request.json().catch((e) => {
            console.error("[Z-API] JSON Parse Error:", e);
            return null;
          });

          if (!body) {
            return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          console.log("[Z-API] Payload received:", JSON.stringify(body).substring(0, 100) + "...");

          // 2. Save to Supabase (Non-blocking as much as possible)
          // We wrap this in a separate try/catch to ensure it doesn't block the response
          try {
            const supabase = getSupabase();
            const { error: logError } = await supabase
              .from("webhook_logs")
              .insert({
                barbershop_id: barbershopId,
                payload: body,
                created_at: new Date().toISOString(),
              });

            if (logError) {
              console.error("[Z-API] Supabase Insert Error Details:", JSON.stringify(logError, null, 2));
            } else {
              console.log("[Z-API] Log saved to Supabase successfully");
            }
          } catch (err) {
            console.error("[Z-API] Database execution failed:", err);
          }

          // 3. Respond immediately
          return new Response(
            JSON.stringify({ success: true }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } catch (error) {
          console.error("[Z-API] Global Handler Error:", error);
          return new Response(
            JSON.stringify({ success: false, message: "Internal Server Error" }),
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
