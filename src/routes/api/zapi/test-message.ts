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

export const Route = createFileRoute("/api/zapi/test-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { tenantId, message, phone } = body;

          if (!tenantId) {
            throw new Error("Tenant ID is required");
          }

          const supabase = getSupabase();
          
          // Get connection details
          const { data: connection, error: connError } = await supabase
            .from("whatsapp_connections")
            .select("*")
            .eq("barbershop_id", tenantId)
            .single();

          if (connError || !connection) {
            throw new Error("Conexão WhatsApp não encontrada para esta barbearia");
          }

          const instanceId = String(connection.instance_id).trim();
          const token = String(connection.instance_token).trim();
          const testMessage = message || "Olá! Este é um teste de automação do BarberLM.";
          const targetPhone = phone || "5571999999999"; // Default or from body

          const fullUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
          
          console.log('[Z-API] Sending test message:', fullUrl);

          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone: targetPhone,
              message: testMessage
            })
          });

          const responseData = await response.json();
          console.log('[Z-API] Send message response:', JSON.stringify(responseData));

          if (!response.ok) {
            throw new Error(responseData.message || "Erro ao enviar mensagem via Z-API");
          }

          return Response.json({
            success: true,
            data: responseData
          });

        } catch (error: any) {
          console.error('[Z-API] Test message error:', error);
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
