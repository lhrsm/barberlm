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
            throw new Error("Instance ID e Token são obrigatórios");
          }

          // Higienizar inputs para evitar espaços ou quebras de linha
          const cleanInstanceId = String(instanceId).trim();
          const cleanToken = String(token).trim();

          const fullUrl = `https://api.z-api.io/instances/${cleanInstanceId}/token/${cleanToken}/status`;
          
          // DEBUG REAIS HEADERS - Seguindo solicitação do usuário
          const headers = {
            'Content-Type': 'application/json'
          };
          
          console.log('--- DEBUG REAIS HEADERS ---');
          console.log('URL FINAL:', fullUrl);
          console.log('HEADERS:', JSON.stringify(headers));
          console.log('CLIENT-TOKEN EXISTE?', !!(headers as any)['Client-Token']);

          const response = await fetch(fullUrl, {
            method: 'GET',
            headers: headers
          });

          const responseText = await response.text();
          console.log('Z-API RAW RESPONSE:', responseText);

          if (!response.ok) {
            throw new Error(`Z-API Error: ${response.status} - ${responseText}`);
          }

          const data = JSON.parse(responseText);
          const isConnected = data.connected === true || data.connected === 'true';

          if (connectionId) {
            const supabase = getSupabase();
            await supabase
              .from("whatsapp_connections")
              .update({
                status: isConnected ? 'connected' : 'disconnected',
                connected: isConnected,
                updated_at: new Date().toISOString(),
                last_connection: isConnected ? new Date().toISOString() : undefined
              })
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
            { status: 500 }
          );
        }
      },
    },
  },
});
