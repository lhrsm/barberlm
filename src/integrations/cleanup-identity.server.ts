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

    // 2. Remove ALL duplicate records in public.customers for this legacy user
    const { data: beforeDel, error: checkError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('user_id', legacyUserId);
    
    console.log("Identified legacy customer records:", beforeDel);

    if (beforeDel && beforeDel.length > 0) {
      for (const row of beforeDel) {
        const { error: delErr } = await supabaseAdmin
          .from('customers')
          .delete()
          .eq('id', row.id);
        console.log(delErr ? `Error deleting customer ${row.id}: ${delErr.message}` : `Deleted customer ${row.id}`);
      }
    }

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
