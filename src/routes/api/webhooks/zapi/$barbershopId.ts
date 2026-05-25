import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client lazily
const getSupabase = () => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
};

export const Route = createFileRoute("/api/webhooks/zapi/$barbershopId")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          success: true,
          message: 'Webhook online'
        });
      },
      POST: async ({ request, params }) => {
        const { barbershopId } = params;
        try {
          const body = await request.json();
          console.log(`[Z-API Webhook] Received for ${barbershopId}:`, body);

          // Save to Supabase logs
          const supabase = getSupabase();
          await supabase
            .from("webhook_logs")
            .insert({
              barbershop_id: barbershopId,
              payload: body,
              event_type: body.type || 'zapi_event',
              status: 'received'
            });

          return Response.json({
            success: true
          });

        } catch (error) {
          console.error('[Z-API Webhook] Error:', error);
          return Response.json(
            { success: false },
            { status: 500 }
          );
        }
      },
    },
  },
});
