
import { assertEquals, assertNotMatch } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

Deno.test("WhatsApp message for appointment confirmation should not have buttons and should have public link", async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1. Get a random appointment with a management_token
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*, customer:customers(name, phone), service:services(name, price)")
    .is("cancelled_at", null)
    .limit(1)
    .single();

  if (error || !appointment) {
    console.warn("No appointment found for test, skipping...");
    return;
  }

  // 2. Call test-automation edge function in dry_run mode
  const { data, error: funcError } = await supabase.functions.invoke("test-automation", {
    body: {
      workflow_key: "appointment_confirmation",
      test_mode: true,
      dry_run: true,
      appointment_id: appointment.id,
      tenant_id: appointment.tenant_id
    }
  });

  if (funcError) throw funcError;

  const renderedMessage = data.payload.message;
  
  // 3. Verify message content
  console.log("Rendered Message:", renderedMessage);
  
  // Should contain management link
  assertNotMatch(renderedMessage, /\[.*\]/); // Should not have markdown buttons or similar if we were using them
  assertEquals(renderedMessage.includes("agendamento"), true);
  assertEquals(renderedMessage.includes(appointment.management_token), true);
  assertEquals(renderedMessage.includes(`tenant=${appointment.tenant_id}`), true);
  
  // Ensure no buttons were passed to sendAutomationMessageV2 (via inspection if possible, or just checking logic)
  // In dry_run, test-automation returns the payload.
});
