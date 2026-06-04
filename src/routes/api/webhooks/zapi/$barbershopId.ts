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
        const supabase = getSupabase();
        
        try {
          const body = await request.json();
          console.log(`[Z-API Webhook] Body from ${barbershopId}:`, JSON.stringify(body));

          // 1. Log immediately
          await supabase.from("webhook_logs").insert({
            barbershop_id: barbershopId,
            payload: body,
            event_type: body.type || 'zapi_event',
            status: 'received'
          });

          // 2. Simple logic for Single Flow Confirmation
          // In the functional version, we handle 'ReceivedCallback' from Z-API
          if (body.type === 'ReceivedCallback' && body.buttonsResponseMessage) {
            const buttonId = body.buttonsResponseMessage.buttonId;
            const phone = body.phone;
            
            console.log(`[Z-API Webhook] Button clicked: ${buttonId} by ${phone}`);

            if (buttonId === 'main_confirm') {
              // Find the most recent pending/scheduled appointment for this phone
              const { data: appts } = await supabase
                .from("appointments")
                .select("id, tenant_id")
                .eq("tenant_id", barbershopId)
                .in("status", ["scheduled", "awaiting_confirmation"])
                .order("created_at", { ascending: false })
                .limit(1);

              if (appts && appts.length > 0) {
                const apptId = appts[0].id;
                console.log(`[Z-API Webhook] Auto-confirming appointment ${apptId}`);
                
                // Call the RPC to update status
                await supabase.rpc('update_appointment_status', {
                  p_appointment_id: apptId,
                  p_new_status: 'confirmed',
                  p_changed_by_type: 'customer',
                  p_source: 'whatsapp_webhook'
                });

                // Send success message fallback
                // We'll need instance details
                const { data: instance } = await supabase
                  .from("whatsapp_instances")
                  .select("*")
                  .eq("tenant_id", barbershopId)
                  .eq("connected", true)
                  .maybeSingle();

                if (instance) {
                  const baseUrl = instance.server_url || "https://api.z-api.io";
                  const sendUrl = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/send-text`;
                  
                  await fetch(sendUrl, {
                    method: "POST",
                    headers: { 
                      "Content-Type": "application/json",
                      ...(instance.client_token ? { "Client-Token": instance.client_token } : {})
                    },
                    body: JSON.stringify({
                      phone: phone,
                      message: "✅ Seu agendamento foi confirmado com sucesso! Te esperamos lá."
                    })
                  });
                }
              }
            }
          }

          return Response.json({ success: true });

        } catch (error) {
          console.error('[Z-API Webhook] Critical Error:', error);
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
