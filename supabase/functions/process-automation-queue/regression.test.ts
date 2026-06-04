
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test("Regression: process-automation-queue dry_run returns payload", async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Try to find a real appointment to test with
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, tenant_id")
    .limit(1)
    .maybeSingle();
    
  if (!appointment) {
    console.log("No appointment found, skipping regression test");
    return;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-automation-queue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tenant_id: appointment.tenant_id,
      appointment_id: appointment.id,
      dry_run: true
    })
  });

  const data = await response.json();
  assertEquals(response.status, 200);
  assertEquals(data.success, true);
  assertEquals(data.results[0].dry_run, true);
  assertEquals(typeof data.results[0].payload.message, "string");
});
