
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.test("Refund Cycle and Duplicate Protection Test", async () => {
  // 1. Setup mock data
  const tenantId = '00000000-0000-0000-0000-000000000000'; // Assume a valid tenant UUID or create one
  const customerId = '00000000-0000-0000-0000-000000000001';
  
  // Create a mock appointment
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      tenant_id: tenantId,
      user_id: tenantId,
      customer_id: customerId,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
      status: 'confirmed',
      payment_status: 'paid',
      total_price: 100,
      final_amount: 100
    })
    .select()
    .single();

  if (apptError) throw apptError;

  try {
    // 2. Test initial refund request
    const { data: refund1, error: error1 } = await supabase.rpc('request_appointment_refund', {
      p_appointment_id: appointment.id,
      p_customer_id: customerId,
      p_tenant_id: tenantId,
      p_amount: 100,
      p_pix_key: 'test-pix-key',
      p_pix_key_type: 'cpf',
      p_account_holder_name: 'Test Holder'
    });

    assertEquals(refund1.success, true, "First refund request should succeed");

    // 3. Test duplicate refund request
    const { data: refund2 } = await supabase.rpc('request_appointment_refund', {
      p_appointment_id: appointment.id,
      p_customer_id: customerId,
      p_tenant_id: tenantId,
      p_amount: 100,
      p_pix_key: 'test-pix-key',
      p_pix_key_type: 'cpf',
      p_account_holder_name: 'Test Holder'
    });

    assertEquals(refund2.success, false, "Duplicate refund request should fail");
    assertEquals(refund2.error, "Já existe uma solicitação de estorno ativa para este agendamento.");

    // 4. Test audit trail
    const { data: audits } = await supabase
      .from("refund_audits")
      .select("*")
      .eq("refund_id", refund1.refund_id);

    assertEquals(audits?.length, 1, "Initial audit log should exist");
    assertEquals(audits?.[0].new_status, 'requested');

    // 5. Test status transitions (requested -> approved -> completed)
    const { error: updateError } = await supabase
      .from("refund_requests")
      .update({ status: 'approved' })
      .eq("id", refund1.refund_id);
    
    if (updateError) throw updateError;

    const { data: auditsUpdated } = await supabase
      .from("refund_audits")
      .select("*")
      .eq("refund_id", refund1.refund_id)
      .eq("new_status", 'approved');

    assertEquals(auditsUpdated?.length, 1, "Update to approved should be logged in audits");

  } finally {
    // Cleanup
    await supabase.from("appointments").delete().eq("id", appointment.id);
  }
});
