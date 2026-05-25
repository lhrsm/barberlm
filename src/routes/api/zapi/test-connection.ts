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

          if (!instanceId || !token) {
            throw new Error("ID da Instância e Token são obrigatórios");
          }

          const cleanInstanceId = String(instanceId).trim();
          const cleanToken = String(token).trim();

          // Use exactly the URL requested by the user
          const fullUrl = `https://api.z-api.io/instances/${cleanInstanceId}/token/${cleanToken}/status`;
          
          console.log('INSTANCE ID', cleanInstanceId);
          console.log('TOKEN', cleanToken);
          console.log('[Z-API] Testing connection:', fullUrl);

          const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();
          console.log('STATUS RESPONSE', JSON.stringify(data));

          // Logic for connected status according to Z-API documentation and user request
          const isConnected = data.connected === true || 
                            data.connected === 'true' || 
                            data.value === 'CONNECTED' ||
                            data.status === 'CONNECTED' ||
                            data.status === 'connected';

          if (connectionId) {
            const supabase = getSupabase();
            await supabase
              .from("whatsapp_connections")
              .update({
                status: isConnected ? 'connected' : 'disconnected',
                connected: isConnected,
                updated_at: new Date().toISOString()
              })
              .eq("id", connectionId);
          }

          return Response.json({
            success: true,
            connected: isConnected,
            data
          });

        } catch (error: any) {
          console.error('[Z-API] Test connection error:', error);
          return Response.json(
            {
              success: false,
              error: error.message || String(error)
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
