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
    console.log("[AnniversaryScheduler] Checking for anniversaries...");
    
    // Timezone: America/Sao_Paulo
    const now = new Date();
    const today = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentYear = today.getFullYear();
    
    // 1. Find barbershops (profiles) with opening_date
    const { data: shops, error: shopsError } = await supabase
      .from("profiles")
      .select("id, business_name, opening_date, tenant_id")
      .not("opening_date", "is", null)
      .in("role", ["tenant_admin", "barber"]);

    if (shopsError) throw shopsError;

    console.log(`[AnniversaryScheduler] Found ${shops?.length || 0} shops with opening date.`);

    const results = [];

    for (const shop of (shops || [])) {
      const openingDate = new Date(shop.opening_date);
      
      // Calculate this year's anniversary
      const anniversaryThisYear = new Date(currentYear, openingDate.getUTCMonth(), openingDate.getUTCDate());
      
      // Check if today is anniversary or 7 days before
      const diffTime = anniversaryThisYear.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let messageType: "reminder_7_days" | "anniversary_day" | null = null;
      
      if (diffDays === 0) {
        messageType = "anniversary_day";
      } else if (diffDays === 7) {
        messageType = "reminder_7_days";
      }

      if (messageType) {
        console.log(`[AnniversaryScheduler] Shop ${shop.business_name} (${shop.id}) has ${messageType} today!`);
        
        // Find active customers for this shop
        // In this project, customers are linked via user_id (which is the profile id of the barber/tenant)
        const { data: customers, error: customersError } = await supabase
          .from("customers")
          .select("id, name, phone")
          .eq("user_id", shop.id);
        
        if (customersError) {
          console.error(`Error fetching customers for shop ${shop.id}:`, customersError);
          continue;
        }

        console.log(`[AnniversaryScheduler] Triggering messages for ${customers?.length || 0} customers.`);

        for (const customer of (customers || [])) {
          // Check if already sent for this year and type (Idempotency)
          const { data: existing } = await supabase
            .from("automation_v2_dispatches")
            .select("id")
            .eq("tenant_id", shop.tenant_id || shop.id)
            .eq("customer_id", customer.id)
            .eq("workflow_key", "barbershop_anniversary")
            .eq("anniversary_year", currentYear)
            .eq("anniversary_message_type", messageType)
            .maybeSingle();

          if (existing) {
            console.log(`[AnniversaryScheduler] Skipping customer ${customer.id} - already sent.`);
            continue;
          }

          // Trigger automation engine for this customer
          // The engine will handle the template and actual sending
          // We can use process-automation-queue or invoke automation-v2-engine directly
          // For simplicity and following project pattern, we'll create a record in automation_v2_dispatches 
          // but wait, we need to send the message too.
          
          try {
            // Get the template
            const { data: template } = await supabase
              .from("automation_templates")
              .select("*")
              .eq("tenant_id", shop.tenant_id || shop.id)
              .eq("key", "barbershop_anniversary")
              .maybeSingle();

            if (!template || !template.active) continue;

            let renderedMessage = "";
            if (messageType === "reminder_7_days") {
              renderedMessage = `Olá ${customer.name || 'Cliente'} 👋\n\nO aniversário da ${shop.business_name} está chegando! 🎉\n\nFaltam apenas 7 dias para celebrarmos mais um ano dessa história com você.\n\nPrepare-se, porque vem comemoração especial por aí! 💈`;
            } else {
              renderedMessage = template.template.replace("{customer_name}", customer.name || 'Cliente').replace("{barbershop_name}", shop.business_name);
            }

            // Call the engine to send
            const { data: engineResponse, error: engineError } = await supabase.functions.invoke("process-automation-queue", {
              body: {
                action: "trigger_direct",
                params: {
                  tenant_id: shop.tenant_id || shop.id,
                  workflow_key: "barbershop_anniversary",
                  customer_id: customer.id,
                  customer_phone: customer.phone,
                  customer_name: customer.name,
                  message: renderedMessage,
                  payload: {
                    anniversary_message_type: messageType,
                    anniversary_year: currentYear,
                    coupon_code: "FESTEJE10"
                  }
                }
              }
            });

            if (engineError) throw engineError;
            
            // The engine already creates the dispatch, but we need to ensure anniversary_year and type are set for idempotency.
            // Since we added these columns, the engine's sendAutomationMessageV2 needs to know about them.
            // I'll update the engine to pick these up from payload.
            
          } catch (e) {
            console.error(`Error triggering for customer ${customer.id}:`, e);
          }
        }
        
        results.push({ shop: shop.business_name, messageType, customersCount: customers?.length || 0 });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[AnniversaryScheduler] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});