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
    // Use offset to get Sao Paulo time
    const spOffset = -3; // UTC-3
    const today = new Date(now.getTime() + (spOffset * 60 * 60 * 1000));
    
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();
    const currentDate = today.getUTCDate();
    
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
      
      // Anniversary day and month
      const annMonth = openingDate.getUTCMonth();
      const annDate = openingDate.getUTCDate();
      
      // Calculate anniversary this year
      const anniversaryThisYear = new Date(Date.UTC(currentYear, annMonth, annDate));
      
      // Calculate diff in days
      const todayUTC = new Date(Date.UTC(currentYear, currentMonth, currentDate));
      const diffTime = anniversaryThisYear.getTime() - todayUTC.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      let messageType: "reminder_7_days" | "anniversary_day" | null = null;
      
      if (diffDays === 0) {
        messageType = "anniversary_day";
      } else if (diffDays === 7) {
        messageType = "reminder_7_days";
      }

      if (messageType) {
        console.log(`[AnniversaryScheduler] Shop ${shop.business_name} (${shop.id}) has ${messageType} today! (diffDays: ${diffDays})`);
        
        // Find active customers for this shop
        const { data: customers, error: customersError } = await supabase
          .from("customers")
          .select("id, name, phone")
          .eq("user_id", shop.id);
        
        if (customersError) {
          console.error(`Error fetching customers for shop ${shop.id}:`, customersError);
          continue;
        }

        // Get the template id
        const { data: template } = await supabase
          .from("automation_templates")
          .select("id, active")
          .eq("tenant_id", shop.tenant_id || shop.id)
          .eq("key", "barbershop_anniversary")
          .maybeSingle();

        if (!template || !template.active) {
          console.log(`[AnniversaryScheduler] Template not found or inactive for shop ${shop.id}`);
          continue;
        }

        console.log(`[AnniversaryScheduler] Queueing messages for ${customers?.length || 0} customers.`);

        for (const customer of (customers || [])) {
          // Check if already sent OR ALREADY IN QUEUE for this year and type
          const { data: existingDispatch } = await supabase
            .from("automation_v2_dispatches")
            .select("id")
            .eq("tenant_id", shop.tenant_id || shop.id)
            .eq("customer_id", customer.id)
            .eq("workflow_key", "barbershop_anniversary")
            .eq("anniversary_year", currentYear)
            .eq("anniversary_message_type", messageType)
            .maybeSingle();

          if (existingDispatch) continue;

          const { data: existingQueue } = await supabase
            .from("automation_queue")
            .select("id")
            .eq("tenant_id", shop.tenant_id || shop.id)
            .eq("customer_id", customer.id)
            .eq("workflow_key", "barbershop_anniversary")
            .filter("payload->>anniversary_year", "eq", currentYear.toString())
            .filter("payload->>anniversary_message_type", "eq", messageType)
            .maybeSingle();

          if (existingQueue) continue;

          // Insert into queue
          await supabase.from("automation_queue").insert({
            tenant_id: shop.tenant_id || shop.id,
            customer_id: customer.id,
            automation_id: template.id,
            workflow_key: "barbershop_anniversary",
            status: "pending",
            payload: {
              customer_name: customer.name,
              anniversary_message_type: messageType,
              anniversary_year: currentYear,
              coupon_code: "FESTEJE10"
            }
          });
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