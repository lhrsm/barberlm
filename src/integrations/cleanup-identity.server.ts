import { supabaseAdmin } from './supabase/client.server';

export async function runIdentityCleanup() {
  console.log("Starting Identity Cleanup for phone 5571996242196...");

  const targetPhone = '5571996242196';
  const legacyUserId = '703dcd8f-0077-4a57-8728-be05f654bd5b';
  const correctUserId = '997746ee-723f-40e4-a6c6-5359eddd2a98';

  try {
    // 1. Remove phone number from legacy user in auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(legacyUserId, {
      phone: '' 
    });
    console.log(authError ? `Auth phone clear error: ${authError.message}` : "Legacy auth phone cleared.");

    // 2. Remove the duplicate record in public.customers
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('user_id', legacyUserId)
      .eq('phone', targetPhone);
    console.log(customerError ? `Customer delete error: ${customerError.message}` : "Duplicate customer record deleted.");

    // 3. Update correct profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        identity_status: 'completed',
        role: 'client'
      })
      .eq('id', correctUserId);
    console.log(profileError ? `Profile update error: ${profileError.message}` : "Client profile updated.");

    return { success: true };
  } catch (err: any) {
    console.error("Cleanup CRASHED:", err);
    return { success: false, error: err.message };
  }
}
