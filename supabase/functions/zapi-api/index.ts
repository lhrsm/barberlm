import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

function maskToken(token: string | null | undefined) {
  if (!token) return "Não configurado";
  if (token.length <= 8) return "********";
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, instanceId: tableId, data } = await req.json();

    const { data: instance, error: instError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", tableId)
      .single();

    if (instError || !instance) {
      throw new Error("Instância não encontrada");
    }

    const instanceId = instance.instance_id;
    const token = instance.token;
    const clientToken = instance.client_token;
    const baseUrl = instance.server_url || "https://api.z-api.io";

    console.log(`[Z-API] Action: ${action} | Instance: ${instanceId}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (clientToken) {
      headers["Client-Token"] = clientToken;
    }

    async function logToDb(params: {
      action: string, 
      request: any, 
      response: any, 
      status: number,
      endpoint?: string,
      method?: string,
      webhook_url?: string,
      phone?: string,
      errorMessage?: string
    }) {
      try {
        await supabase
          .from("zapi_integration_logs")
          .insert([{
            tenant_id: instance.tenant_id,
            instance_id: instanceId,
            action: params.action,
            method: params.method || (params.action.includes('update') ? 'PUT' : 'GET'),
            request_payload: params.request,
            request_body: params.request,
            response_payload: params.response,
            response_body: params.response,
            status_code: params.status,
            response_status: params.status,
            endpoint: params.endpoint,
            webhook_url: params.webhook_url,
            phone_number: params.phone,
            error_message: params.errorMessage,
            token_masked: maskToken(token),
            client_token_masked: maskToken(clientToken)
          }]);
      } catch (e) {
        console.error("[Z-API] Error logging to DB:", e.message);
      }
    }

    if (action === "check-status") {
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/status`;
      const res = await fetch(url, { method: "GET", headers });
      const status_code = res.status;
      const result = await res.json();

      const isConnected = result?.connected === true;
      const status = isConnected ? 'connected' : 'disconnected';

      await supabase
        .from("whatsapp_instances")
        .update({ 
          status, 
          connected: isConnected,
          updated_at: new Date().toISOString()
        })
        .eq("id", tableId);

      await logToDb({ 
        action: "check-status", 
        method: "GET",
        request: { url }, 
        response: result, 
        status: status_code, 
        endpoint: url 
      });

      return new Response(JSON.stringify({ 
        success: true, 
        connected: isConnected, 
        status,
        raw: result 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "update-notify-sent-by-me") {
      const { notifySentByMe } = data;
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/update-notify-sent-by-me`;
      
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ notifySentByMe })
      });
      
      const status_code = res.status;
      const result = await res.json();

      await logToDb({ 
        action: "update-notify-sent-by-me", 
        method: "PUT",
        request: { notifySentByMe }, 
        response: result, 
        status: status_code, 
        endpoint: url 
      });

      return new Response(JSON.stringify({ 
        success: status_code === 200, 
        result,
        status: status_code,
        endpoint: url,
        requestBody: { notifySentByMe },
        headers: {
          "Content-Type": "application/json",
          "Client-Token": maskToken(clientToken)
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "update-every-webhooks") {
      const { webhookUrl, notifySentByMe } = data;
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/update-every-webhooks`;
      
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ value: webhookUrl, notifySentByMe })
      });
      
      const status_code = res.status;
      const result = await res.json();

      await logToDb({ 
        action: "update-every-webhooks", 
        method: "PUT",
        request: { value: webhookUrl, notifySentByMe }, 
        webhook_url: webhookUrl,
        response: result, 
        status: status_code, 
        endpoint: url 
      });

      return new Response(JSON.stringify({ 
        success: status_code === 200, 
        result,
        status: status_code,
        endpoint: url,
        requestBody: { value: webhookUrl, notifySentByMe },
        headers: {
          "Content-Type": "application/json",
          "Client-Token": maskToken(clientToken)
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "update-webhook-received") {
      const webhookUrl = data.webhookUrl;
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/update-webhook-received`;
      
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ value: webhookUrl })
      });
      
      const status_code = res.status;
      const result = await res.json();

      // Se o PUT retornar 200, salvar na tabela da integração
      if (status_code === 200) {
        await supabase
          .from("whatsapp_instances")
          .update({
            webhook_received_url: webhookUrl,
            webhook_received_configured_at: new Date().toISOString(),
            webhook_received_last_response: result
          })
          .eq("id", tableId);
      }

      await logToDb({ 
        action: "update-webhook-received", 
        method: "PUT",
        request: { value: webhookUrl }, 
        webhook_url: webhookUrl,
        response: result, 
        status: status_code, 
        endpoint: url 
      });

      return new Response(JSON.stringify({ 
        success: status_code === 200, 
        result,
        status: status_code,
        endpoint: url,
        requestBody: { value: webhookUrl },
        headers: {
          "Content-Type": "application/json",
          "Client-Token": maskToken(clientToken)
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "send-test-message") {
      const phone = data.phone;
      const message = data.message || "Teste de integração Z-API";
      
      // 1. Validations
      if (!instanceId) throw new Error("instance_id ausente");
      if (!token) throw new Error("token ausente");
      if (!clientToken) throw new Error("client_token ausente");
      if (!phone) throw new Error("telefone de destino ausente");
      if (!phone.startsWith("55") || phone.length < 12) throw new Error("telefone deve estar no formato 55DDDNUMERO");
      
      const result = await sendMessage(instance, phone, message);
      
      const status_code = result.success ? 200 : (result.response?.status || 400);
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;

      await logToDb({ 
        action: "send-test-message", 
        method: "POST",
        request: { phone, message }, 
        response: result.response, 
        status: status_code, 
        endpoint: url,
        phone: phone,
        errorMessage: result.error
      });

      return new Response(JSON.stringify({ 
        success: result.success, 
        result: result.response,
        error: result.error,
        endpoint: url,
        status: status_code
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "send-test-button") {
      const phone = data.phone;
      if (!phone) throw new Error("telefone de destino ausente");
      
      const result = await sendMessage(instance, phone, "Teste de botão. Clique abaixo para confirmar o recebimento do webhook.", {
        buttons: [
          { id: "main_confirm", label: "Confirmar agendamento" }
        ]
      });
      
      const status_code = result.success ? 200 : (result.response?.status || 400);
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/send-button`;

      await logToDb({ 
        action: "send-test-button", 
        method: "POST",
        request: { phone, buttons: true }, 
        response: result.response, 
        status: status_code, 
        endpoint: url,
        phone: phone,
        errorMessage: result.error
      });

      return new Response(JSON.stringify({ 
        success: result.success, 
        result: result.response,
        error: result.error,
        endpoint: url,
        status: status_code
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "set-webhook") {
      const webhookUrl = data.webhookUrl;
      const types = [
        { id: "update-webhook-received", required: true },
        { id: "update-webhook-disconnected", required: true },
        { id: "update-webhook-connected", required: true },
        { id: "update-webhook-message-status", required: true }
      ];
      
      const results = await Promise.all(types.map(async (typeInfo) => {
        const webhookType = typeInfo.id;
        const url = `${baseUrl}/instances/${instanceId}/token/${token}/${webhookType}`;
        try {
          const res = await fetch(url, {
            method: "PUT",
            headers,
            body: JSON.stringify({ value: webhookUrl })
          });
          const status_code = res.status;
          const result = await res.json();
          
          await logToDb({ 
            action: `set-webhook:${webhookType}`, 
            method: "PUT",
            request: { value: webhookUrl }, 
            webhook_url: webhookUrl,
            response: result, 
            status: status_code, 
            endpoint: url 
          });

          // Consider success if status is 2xx OR if optional and returned 404/not found
          const isSuccess = status_code === 200 || status_code === 201 || result?.value === true || result?.success === true;
          const notFoundOptional = !typeInfo.required && (status_code === 404 || (result?.message && result.message.toLowerCase().includes("not found")));

          return { 
            type: webhookType, 
            result, 
            status: status_code, 
            url, 
            success: isSuccess,
            required: typeInfo.required,
            isCompatible: isSuccess || notFoundOptional,
            endpointUsed: url,
            methodUsed: "PUT"
          };
        } catch (e) {
          return { type: webhookType, error: e.message, success: false, required: typeInfo.required, isCompatible: false, url };
        }
      }));

      // Success if all REQUIRED endpoints are successful
      const allRequiredSuccessful = results.filter(r => r.required).every(r => r.success);
      const allCompatible = results.every(r => r.isCompatible);
      const isOverallSuccess = allRequiredSuccessful;

      // Save the primary one in the instance table for reference
      if (isOverallSuccess) {
        await supabase
          .from("whatsapp_instances")
          .update({
            webhook_received_url: webhookUrl,
            webhook_received_configured_at: new Date().toISOString(),
            webhook_received_last_response: { 
              results, 
              summary: allCompatible ? "All webhooks configured or compatible" : "Primary webhooks configured, some optional failed",
              allCompatible
            }
          })
          .eq("id", tableId);
      }

      return new Response(JSON.stringify({ 
        success: isOverallSuccess, 
        allCompatible,
        results,
        endpoint: `${baseUrl}/instances/${instanceId}/token/${token}/[type]`,
        requestBody: { value: webhookUrl },
        headers: {
          "Content-Type": "application/json",
          "Client-Token": maskToken(clientToken)
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "disconnect") {
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/disconnect`;
      const res = await fetch(url, {
        method: "GET",
        headers
      });
      const status_code = res.status;
      const result = await res.json();
      
      await logToDb({ 
        action: "disconnect", 
        method: "GET",
        request: { url }, 
        response: result, 
        status: status_code, 
        endpoint: url 
      });

      await supabase
        .from("whatsapp_instances")
        .update({ 
          status: 'disconnected', 
          connected: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", tableId);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "test-received-callback") {
      const { phone, text, messageId } = data;
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zapi-receive-json`;
      
      const payload = {
        type: "ReceivedCallback",
        fromMe: false,
        phone,
        messageId: messageId || `test-${Date.now()}`,
        text: { message: text },
        body: { text: { message: text } },
        timestamp: Date.now()
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      
      return new Response(JSON.stringify({ 
        success: res.ok, 
        result,
        webhookUrl,
        payloadSent: payload
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Ação inválida");

  } catch (error) {
    console.error("[Z-API Edge Function] Error:", error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      ok: false,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
