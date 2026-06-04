
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("[ReprocessJob] Starting reprocess job...");

    // 1. Reprocessar Mensagens Pendentes na Fila (automation_queue)
    // Buscamos itens que falharam ou estão pendentes e ainda têm tentativas
    const { data: pendingQueue, error: queueError } = await supabase
      .from("automation_queue")
      .select("id, appointment_id, tenant_id")
      .in("status", ["pending", "failed"])
      .lt("attempts", 3)
      .limit(20);

    if (queueError) console.error("[ReprocessJob] Error fetching pending queue:", queueError);

    const queueResults = [];
    if (pendingQueue && pendingQueue.length > 0) {
      console.log(`[ReprocessJob] Found ${pendingQueue.length} items in queue to reprocess.`);
      for (const item of pendingQueue) {
        try {
          // Chamamos a função de processamento para cada item
          const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-automation-queue`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({
              appointment_id: item.appointment_id,
              tenant_id: item.tenant_id
            })
          });
          const result = await response.json();
          queueResults.push({ id: item.id, success: response.ok, result });
        } catch (err) {
          console.error(`[ReprocessJob] Failed to reprocess queue item ${item.id}:`, err);
          queueResults.push({ id: item.id, success: false, error: err.message });
        }
      }
    }

    // 2. Reprocessar Webhooks (Callbacks) não processados
    // Buscamos webhooks que chegaram mas não resultaram em um log de "resposta_recebida" ou "finalizado"
    // Isso é mais complexo, vamos focar em webhooks de "ReceivedCallback" que não têm appointment_id vinculado ou processado
    const { data: pendingWebhooks, error: webhookError } = await supabase
      .from("automation_webhook_logs")
      .select("*")
      .eq("type", "ReceivedCallback")
      .is("processed_at", null) // Assumindo que adicionamos essa coluna ou verificamos por logs vinculados
      .order("created_at", { ascending: false })
      .limit(20);

    if (webhookError) console.error("[ReprocessJob] Error fetching pending webhooks:", webhookError);

    const webhookResults = [];
    if (pendingWebhooks && pendingWebhooks.length > 0) {
      console.log(`[ReprocessJob] Found ${pendingWebhooks.length} webhooks to reprocess.`);
      for (const webhook of pendingWebhooks) {
        try {
          // Re-enviamos o payload para a função de recebimento
          const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/zapi-receive-json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify(webhook.raw_payload)
          });
          
          if (response.ok) {
            // Marcar como processado se a função retornou OK
            await supabase
              .from("automation_webhook_logs")
              .update({ processed_at: new Date().toISOString() })
              .eq("id", webhook.id);
          }
          
          webhookResults.push({ id: webhook.id, success: response.ok });
        } catch (err) {
          console.error(`[ReprocessJob] Failed to reprocess webhook ${webhook.id}:`, err);
          webhookResults.push({ id: webhook.id, success: false, error: err.message });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      queue: queueResults, 
      webhooks: webhookResults 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[ReprocessJob] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
