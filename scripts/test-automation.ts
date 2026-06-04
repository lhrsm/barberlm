import { createClient } from '@supabase/supabase-js';

async function testAutomationActiveStatus() {
  console.log('--- TEST: Automation Active Status ---');
  
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables for test');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Get a sample tenant and automation
    const { data: tenant } = await supabase.from('barbershops').select('id').limit(1).single();
    if (!tenant) throw new Error('No barbershop found');
    const tenantId = tenant.id;

    const { data: automation } = await supabase
      .from('automation_templates')
      .select('id, active')
      .eq('key', 'appointment_confirmation')
      .limit(1)
      .single();
    
    if (!automation) throw new Error('Automation template not found');

    // Ensure we have a customer, barber, and service for this tenant
    const { data: customer } = await supabase.from('customers').select('id').eq('barbershop_id', tenantId).limit(1).single();
    const { data: barber } = await supabase.from('barbers').select('id').eq('barbershop_id', tenantId).limit(1).single();
    const { data: service } = await supabase.from('services').select('id').eq('barbershop_id', tenantId).limit(1).single();

    if (!customer || !barber || !service) {
      console.log('Skipping test: Missing required related records (customer/barber/service)');
      return;
    }

    // SCENARIO 1: Automation is INACTIVE
    console.log('Scenario 1: Testing INACTIVE automation...');
    await supabase.from('automation_templates').update({ active: false }).eq('id', automation.id);

    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 2);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    const { data: inactiveAppointment, error: inactiveError } = await (supabase as any).from('appointments').insert({
      barbershop_id: tenantId,
      customer_id: customer.id,
      barber_id: barber.id,
      service_id: service.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'confirmed'
    }).select().single();

    if (inactiveError) throw inactiveError;

    // Wait a bit for trigger
    await new Promise(r => setTimeout(r, 1000));

    const { data: queueInactive } = await supabase.from('automation_queue').select('*').eq('appointment_id', inactiveAppointment.id);
    if (queueInactive && queueInactive.length > 0) {
      console.error('FAIL: Item was queued for an INACTIVE automation');
    } else {
      console.log('SUCCESS: No item queued for inactive automation');
    }

    // SCENARIO 2: Automation is ACTIVE
    console.log('Scenario 2: Testing ACTIVE automation...');
    await supabase.from('automation_templates').update({ active: true }).eq('id', automation.id);

    const startTime2 = new Date();
    startTime2.setHours(startTime2.getHours() + 4);
    const endTime2 = new Date(startTime2);
    endTime2.setMinutes(endTime2.getMinutes() + 30);

    const { data: activeAppointment, error: activeError } = await (supabase as any).from('appointments').insert({
      barbershop_id: tenantId,
      customer_id: customer.id,
      barber_id: barber.id,
      service_id: service.id,
      start_time: startTime2.toISOString(),
      end_time: endTime2.toISOString(),
      status: 'confirmed'
    }).select().single();

    if (activeError) throw activeError;

    // Wait a bit for trigger
    await new Promise(r => setTimeout(r, 1000));

    const { data: queueActive } = await supabase.from('automation_queue').select('*').eq('appointment_id', activeAppointment.id);
    if (queueActive && queueActive.length > 0) {
      console.log('SUCCESS: Item was correctly queued for active automation');
    } else {
      console.error('FAIL: Item was NOT queued for an active automation');
    }

    // Cleanup
    await supabase.from('appointments').delete().in('id', [inactiveAppointment.id, activeAppointment.id]);
    await supabase.from('automation_queue').delete().in('appointment_id', [inactiveAppointment.id, activeAppointment.id]);
    await supabase.from('automation_templates').update({ active: automation.active }).eq('id', automation.id);

  } catch (err) {
    console.error('Test Error:', err);
  }
}

testAutomationActiveStatus();
