
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test("Regression: zapi-receive-json handles unknown referenceMessageId", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/zapi-receive-json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: "ReceivedCallback",
      fromMe: false,
      phone: "5511999999999",
      buttonsResponseMessage: {
        buttonId: "main_confirm"
      },
      referenceMessageId: "non-existent-message-id-" + Math.random()
    })
  });

  const data = await response.json();
  assertEquals(response.status, 200);
  assertEquals(data.ok, true);
  assertEquals(data.status, "not_found");
});
