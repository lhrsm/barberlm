import { supabaseAdmin } from './supabase/client.server';

async function cleanupIdentityCollision() {
  console.log("Starting Identity Cleanup for phone 5571996242196...");

  // Correct Client: 997746ee-723f-40e4-a6c6-5359eddd2a98
  // Legacy Conflict: 703dcd8f-0077-4a57-8728-be05f654bd5b

  const targetPhone = '5571996242196';
  const legacyUserId = '703dcd8f-0077-4a57-8728-be05f654bd5b';
  const correctUserId = '997746ee-723f-40e4-a6c6-5359eddd2a98';

  // 1. Remove phone number from legacy user in auth.users to prevent unique constraint issues if we ever confirm it
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(legacyUserId, {
    phone: '' // Clear phone from legacy auth user
  });
  
  if (authError) {
    console.error("Error clearing legacy auth phone:", authError.message);
  } else {
    console.log("Cleared legacy auth phone.");
  }

  // 2. Remove the duplicate record in public.customers
  const { error: customerError } = await supabaseAdmin
    .from('customers')
    .delete()
    .eq('user_id', legacyUserId)
    .eq('phone', targetPhone);

  if (customerError) {
    console.error("Error deleting duplicate customer record:", customerError.message);
  } else {
    console.log("Deleted duplicate customer record.");
  }

  // 3. Ensure the correct user is fully set up
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ 
      identity_status: 'completed',
      role: 'client'
    })
    .eq('id', correctUserId);

  if (profileError) {
    console.error("Error updating correct profile:", profileError.message);
  } else {
    console.log("Updated correct client profile status.");
  }

  console.log("Cleanup complete.");
}

cleanupIdentityCollision().catch(console.error);
