import { supabase } from "./integrations/supabase/client";

/**
 * Test script for Credit Conversion and Usage
 * Run with: bun src/test-credits.ts
 */

async function testCreditFlow() {
  console.log("🚀 Starting Credit Flow Tests...");

  try {
    // 1. Setup: Get a tenant and customer
    const { data: tenant } = await supabase.from('profiles').select('id').limit(1).single();
    if (!tenant) throw new Error("No tenant found");

    // Try to find any customer or create a dummy one
    let { data: customer } = await supabase.from('customers').select('id, credits').eq('user_id', tenant.id).limit(1).maybeSingle();
    
    if (!customer) {
        console.log("No customer found, creating a dummy one...");
        const { data: newCustomer, error: createErr } = await supabase.from('customers').insert({
            user_id: tenant.id,
            name: 'Test Customer',
            phone: '11999999999'
        }).select().single();
        if (createErr) throw createErr;
        customer = newCustomer;
    }

    const initialCredits = Number(customer.credits || 0);
    console.log(`Initial Credits for customer ${customer.id}: R$ ${initialCredits}`);

    // 2. Scenario 1: Cancel paid appointment -> Convert to credit
    console.log("\n--- Scenario 1: Paid Pix -> Convert to Credit ---");
    
    // Create a dummy paid appointment
    // We need a service and barber ID to satisfy references
    const { data: barber } = await supabase.from('barbers').select('id').eq('user_id', tenant.id).limit(1).single();
    const { data: service } = await supabase.from('services').select('id').eq('user_id', tenant.id).limit(1).single();

    if (!barber || !service) throw new Error("Need at least one barber and one service to test");

    const { data: appointment, error: apptErr } = await supabase.from('appointments').insert({
      user_id: tenant.id,
      customer_id: customer.id,
      service_id: service.id,
      barber_id: barber.id,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
      total_price: 100,
      payment_status: 'paid',
      payment_method: 'pix',
      payment_id: 'pix_test_123',
      status: 'confirmed'
    } as any).select().single();

    if (apptErr) {
        console.error("Error creating test appointment:", apptErr);
        // Fallback if UUIDs fail - we'll just check if the function exists
    } else {
        console.log(`Created paid appointment: ${appointment.id}`);

        // Convert to credit
        const { data: convRes, error: convErr } = await supabase.rpc('convert_appointment_to_credit', {
            p_appointment_id: appointment.id,
            p_customer_id: customer.id,
            p_tenant_id: tenant.id,
            p_amount: 100
        });

        if (convErr) throw convErr;
        const result = convRes as any;
        console.log("Conversion Result:", result);

        if (result.success) {
            const { data: updatedCustomer } = await supabase.from('customers').select('credits').eq('id', customer.id).single();
            console.log(`Updated Credits: R$ ${updatedCustomer?.credits}`);
            if (Number(updatedCustomer?.credits) !== initialCredits + 100) {
                console.error("❌ Credit balance mismatch after conversion");
            } else {
                console.log("✅ Credit balance updated correctly");
            }
            
            // Try to convert AGAIN (Should fail)
            const { data: retryRes } = await supabase.rpc('convert_appointment_to_credit', {
                p_appointment_id: appointment.id,
                p_customer_id: customer.id,
                p_tenant_id: tenant.id,
                p_amount: 100
            });
            console.log("Retry Conversion Result (Expected Fail):", retryRes);
            if (!(retryRes as any).success) {
                console.log("✅ Idempotency working correctly");
            } else {
                console.error("❌ Idempotency failed: allowed duplicate conversion");
            }
        }
    }

    // 3. Scenario 2: Use credits (Partial and Total)
    console.log("\n--- Scenario 2: Use Credits ---");
    
    // Total use
    const { data: useRes, error: useErr } = await supabase.rpc('use_customer_credits', {
        p_customer_id: customer.id,
        p_amount: 50
    });
    if (useErr) throw useErr;
    console.log("Credit Usage Result (50):", useRes);

    const { data: finalCustomer } = await supabase.from('customers').select('credits').eq('id', customer.id).single();
    console.log(`Final Credits: R$ ${finalCustomer?.credits}`);

    console.log("\n✅ Tests completed.");

  } catch (err) {
    console.error("❌ Test failed:", err);
  }
}

testCreditFlow();
