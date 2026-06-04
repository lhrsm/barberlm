
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test({
  name: "E2E: Full Automation Flow (Send -> Normalize Response -> Finalize)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Setup Data: Find a profile for tenant context
    let { data: profile } = await supabase.from("profiles").select("id").limit(1).single();
    if (!profile) throw new Error("No profile found for testing");
    
    const tenant_id = profile.id;

    // Get or create a customer
    let { data: customer } = await supabase.from("customers").select("id, phone").eq("tenant_id", tenant_id).limit(1).maybeSingle();
    if (!customer) {
      console.log("Creating test customer...");
      const { data: newCust, error: custError } = await supabase.from("customers").insert({
        tenant_id: tenant_id,
        name: "Test User E2E",
        phone: "5511999999999"
      }).select().single();
      if (custError) throw custError;
      customer = newCust;
    }

    if (!customer) throw new Error("Customer not found or created");

    // Create a new appointment to avoid conflicts
    const { data: appointment, error: apptError } = await supabase.from("appointments").insert({
      tenant_id: tenant_id,
      customer_id: customer.id,
      start_time: new Date(Date.now() + 86400000).toISOString(),
      status: 'pending'
    }).select().single();
    if (apptError) throw apptError;

    try {
      // 2. Initial Send: Trigger process-automation-queue
      const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-automation-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenant_id: tenant_id,
          appointment_id: appointment.id,
          force_resend: true
        })
      });

      const sendData = await sendResponse.json();
      assertEquals(sendResponse.status, 200, "Process queue should return 200");
      
      // Verification: Check if session (conversation) was created
      const { data: session } = await supabase
        .from("automation_conversations")
        .select("*")
        .eq("appointment_id", appointment.id)
        .eq("status", "awaiting_response")
        .maybeSingle();
      
      assertEquals(!!session, true, "Conversation session should be created");

      // 3. Normalize Response Tests
      const variations = [
        { text: "1 confirmo", expected: "confirmed" },
        { text: "  confirmar  ", expected: "confirmed" }, // Spaces
        { text: "CONFIRMO", expected: "confirmed" }, // Case
        { text: "cônfirmar", expected: "confirmed" }, // Accents
        { text: "2 reagendar", expected: "pending" }, // Reschedule reverts to pending
        { text: "3 cancelar", expected: "cancelled" }
      ];

      for (const variant of variations) {
        console.log(`Testing variant: "${variant.text}"`);
        
        const webhookResponse = await fetch(`${SUPABASE_URL}/functions/v1/zapi-receive-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: "ReceivedCallback",
            fromMe: false,
            phone: customer.phone,
            text: { message: variant.text },
            messageId: `msg-${Date.now()}-${Math.random()}`
          })
        });

        const webhookData = await webhookResponse.json();
        assertEquals(webhookResponse.status, 200);
        assertEquals(webhookData.ok, true);

        // Check if appointment status updated correctly
        const { data: updatedAppt } = await supabase.from("appointments").select("status").eq("id", appointment.id).single();
        assertEquals(updatedAppt.status, variant.expected, `Status should be ${variant.expected} for text "${variant.text}"`);

        // If it finalized, session should be completed
        const { data: updatedSession } = await supabase.from("automation_conversations").select("status").eq("id", session.id).single();
        if (variant.expected === "confirmed" || variant.expected === "cancelled") {
            // Re-open for next variant if we use same session, but the logic closes it
            // Reset for next variant
            await supabase.from("appointments").update({ status: 'pending' }).eq("id", appointment.id);
            await supabase.from("automation_conversations").update({ status: 'awaiting_response' }).eq("id", session.id);
        }
      }

      // 4. Dedup Test: Rapid fire callbacks
      console.log("Testing deduplication...");
      const msgId1 = `dedup-1-${Date.now()}`;
      const msgId2 = `dedup-2-${Date.now()}`;
      
      const p1 = fetch(`${SUPABASE_URL}/functions/v1/zapi-receive-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "ReceivedCallback",
          fromMe: false,
          phone: customer.phone,
          text: { message: "1" },
          messageId: msgId1
        })
      });

      const p2 = fetch(`${SUPABASE_URL}/functions/v1/zapi-receive-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "ReceivedCallback",
          fromMe: false,
          phone: customer.phone,
          text: { message: "1" },
          messageId: msgId2
        })
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      const d1 = await r1.json();
      const d2 = await r2.json();

      const statuses = [d1.status, d2.status];
      console.log("Dedup statuses:", statuses);
      // One should be undefined/ok and other should ideally be already_processed or duplicate_ignored
      
    } finally {
      // Cleanup
      await supabase.from("automation_logs").delete().eq("appointment_id", appointment.id);
      await supabase.from("automation_conversations").delete().eq("appointment_id", appointment.id);
      await supabase.from("automation_send_history").delete().eq("appointment_id", appointment.id);
      await supabase.from("appointments").delete().eq("id", appointment.id);
    }
  }
});
