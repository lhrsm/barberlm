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

          const headers: any = {
            'Content-Type': 'application/json'
          };

          if (!instanceId || !token) {
            throw new Error("Instance ID e Token são obrigatórios");
          }

          const fullUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
          
          console.log('--- DEBUG Z-API REQUEST ---');
          console.log('HEADERS ENVIADOS:', JSON.stringify(headers));
          console.log('INSTANCE ID:', instanceId);
          console.log('TOKEN:', token);
          console.log('URL:', fullUrl);

          const response = await fetch(
            fullUrl,
            {
              method: 'GET',
              headers
            }
          );

          const responseText = await response.text();
          console.log('Z-API RAW RESPONSE:', responseText);

          if (!response.ok) {
            // Se o erro ainda for "client-token is not configured", vamos logar os headers novamente para ter certeza absoluta
            if (responseText.includes('client-token')) {
              console.error('ERRO CRÍTICO: Z-API reclama de client-token mesmo sem enviarmos o header!');
            }
            throw new Error(`Z-API Error: ${response.status} - ${responseText}`);
          }

          const data = JSON.parse(responseText);
          console.log('Z-API PARSED DATA:', data);

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