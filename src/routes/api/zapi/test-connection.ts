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

export const Route = createFileRoute("/api/zapi/test-connection")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { instanceId, token, connectionId } = body;

          console.log('INSTANCE ID:', instanceId);
          console.log('TOKEN:', token);

          const headers: any = {
            'Content-Type': 'application/json'
          };

          const fullUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
          
          console.log('--- Z-API TEST REQUEST ---');
          console.log('URL:', fullUrl);
          console.log('HEADERS:', JSON.stringify(headers));

          const response = await fetch(
            fullUrl,
            {
              method: 'GET',
              headers
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Z-API Error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log('ZAPI STATUS DATA:', data);

          const isConnected =
            data.connected === true ||
            data.connected === 'true';

          // Update database if connectionId is provided
          if (connectionId) {
            const supabase = getSupabase();
            const updateData: any = {
              status: isConnected ? 'connected' : 'disconnected',
              connected: isConnected,
              updated_at: new Date().toISOString()
            };

            if (isConnected) {
              updateData.last_connection = new Date().toISOString();
            }

            await supabase
              .from("whatsapp_connections")
              .update(updateData)
              .eq("id", connectionId);
          }

          return Response.json({
            success: true,
            data,
            connected: isConnected
          });

        } catch (error: any) {
          console.error('Z-API TEST ERROR:', error);
          return Response.json(
            {
              success: false,
              error: error.message || String(error)
            },
            {
              status: 500
            }
          );
        }
      },
    },
  },
});
