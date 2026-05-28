import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const url = new URL(req.url);
  const method = req.method;
  const headers = Object.fromEntries(req.headers.entries());
  const contentType = headers["content-type"] || "";
  const queryParams = Object.fromEntries(url.searchParams.entries());
  
  let rawBody = "";
  let payloadRaw: any = null;

  try {
    const buffer = await req.arrayBuffer();
    rawBody = new TextDecoder().decode(buffer);
    
    if (contentType.includes("application/json") && rawBody) {
      try {
        payloadRaw = JSON.parse(rawBody);
      } catch (e) {
        console.error("[Z-API Catch-All] JSON parse error:", e);
      }
    }
  } catch (e) {
    console.error("[Z-API Catch-All] Error reading body:", e);
  }

  try {
    // Save to debug table
    await supabase.from("zapi_webhook_debug").insert({
      method,
      url: req.url,
      content_type: contentType,
      headers_raw: headers,
      query_params: queryParams,
      payload_raw: payloadRaw,
      raw_body: rawBody,
      source: "zapi_catch_all",
      received_at: new Date().toISOString(),
      processed: true
    });
  } catch (e) {
    console.error("[Z-API Catch-All] Database error:", e);
  }

  return new Response(JSON.stringify({ 
    ok: true, 
    received: true,
    function: "zapi-catch-all"
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
