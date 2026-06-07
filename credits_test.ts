
import { supabase } from "./src/integrations/supabase/client";

async function runTests() {
  console.log("Starting Credits & Transactional tests...");

  // Mock data
  const tenant_id = "00000000-0000-0000-0000-000000000000"; // Should be a valid UUID in your DB if testing locally
  const customer_id = "00000000-0000-0000-0000-000000000001";
  const appointment_id = "00000000-0000-0000-0000-000000000002";
  const payment_id = "test_pix_123";
  const amount = 50.00;

  // Test 1: Convert to credit (Duplicate Prevention)
  console.log("Test 1: Convert to credit (First time)");
  const { data: res1, error: err1 } = await supabase.rpc('convert_appointment_to_credit', {
    p_appointment_id: appointment_id,
    p_customer_id: customer_id,
    p_tenant_id: tenant_id,
    p_amount: amount
  });
  console.log("Result 1:", res1, err1);

  console.log("Test 2: Convert to credit (Duplicate Appointment)");
  const { data: res2, error: err2 } = await supabase.rpc('convert_appointment_to_credit', {
    p_appointment_id: appointment_id,
    p_customer_id: customer_id,
    p_tenant_id: tenant_id,
    p_amount: amount
  });
  console.log("Result 2:", res2, err2);

  // Test 3: Use credits
  console.log("Test 3: Use credits (Partial)");
  const { data: res3, error: err3 } = await supabase.rpc('use_customer_credits', {
    p_customer_id: customer_id,
    p_amount: 20.00
  });
  console.log("Result 3:", res3, err3);

  console.log("Tests complete.");
}

// Note: This script is intended to be run in an environment where Supabase is configured.
// For the sandbox, we rely on the migration succeeding and manual verification in the UI.
