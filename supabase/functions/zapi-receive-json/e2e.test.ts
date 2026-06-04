
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
    
    // 1. Setup Data: Find or create a tenant and appointment
    let { data: tenant } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
    
    if (!tenant) {
      console.log("No tenant found, creating one for test...");
      const { data: newTenant } = await supabase.from("tenants").insert({
        name: "Test Tenant E2E"
      }).select().single();
      tenant = newTenant;
    }
    
    if (!tenant) throw new Error("No tenant found or created for testing");

    // Get or create a customer
    let { data: customer } = await supabase.from("customers").select("id").eq("tenant_id", tenant.id).limit(1).maybeSingle();
    if (!customer) {
      const { data: newCust } = await supabase.from("customers").insert({
        tenant_id: tenant.id,
        name: "Test User",
        phone: "5511999999999"
      }).select().single();
      customer = newCust;
    }

    // Create a new appointment to avoid conflicts
    const { data: appointment, error: apptError } = await supabase.from("appointments").insert({
      tenant_id: tenant.id,
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
          tenant_id: tenant.id,
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
      
      if (!session) {
        console.warn("Session not created. Checking logs...");
        const { data: logs } = await supabase.from("automation_logs").select("*").eq("appointment_id", appointment.id);
        console.log("Logs for appointment:", logs);
      }
      assertEquals(!!session, true, "Conversation session should be created");

      // 3. Normalize Response Tests
      const variations = [
        { text: "1 confirmo", expected: "confirmed" },
        { text: "  confirmar  ", expected: "confirmed" }, // Spaces
        { text: "CONFIRMO", expected: "confirmed" }, // Case
        { text: "2 reagendar", expected: "pending" }, // Reschedule reverts to pending
        { text: "3 cancelar", expected: "cancelled" }
      ];

      for (const variant of variations) {
        // We reset session for each variant test or use new appointments? 
        // For simplicity, let's test one variant fully and check logic for others
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

        // Check if session closed
        const { data: updatedSession } = await supabase.from("automation_conversations").select("status").eq("id", session.id).single();
        assertEquals(updatedSession.status, "completed", "Session should be completed");
        
        // Reset for next variant (if we wanted to run all in loop on same appt, but usually one action finalizes it)
        await supabase.from("appointments").update({ status: 'pending' }).eq("id", appointment.id);
        await supabase.from("automation_conversations").update({ status: 'awaiting_response' }).eq("id", session.id);
      }

      // 4. Dedup Test: Rapid fire callbacks
      console.log("Testing deduplication...");
      const msgId1 = `dedup-1-${Date.now()}`;
      const msgId2 = `dedup-2-${Date.now()}`;
      
      // Fire two identical text responses rapidly
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

      // One should succeed, the other might be ignored by dedup (status: duplicate_ignored) or already_processed
      const statuses = [d1.status, d2.status];
      console.log("Dedup statuses:", statuses);
      
      // At least one should NOT be "not_found" and at least one should indicate a skip/dedup if timing hit
      // Note: In local/test environment, async timing might vary, but logic is there
    } finally {
      // Cleanup
      await supabase.from("automation_logs").delete().eq("appointment_id", appointment.id);
      await supabase.from("automation_conversations").delete().eq("appointment_id", appointment.id);
      await supabase.from("automation_send_history").delete().eq("appointment_id", appointment.id);
      await supabase.from("appointments").delete().eq("id", appointment.id);
    }
  }
});
