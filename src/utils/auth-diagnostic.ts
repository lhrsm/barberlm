import { supabase } from "@/integrations/supabase/client";

/**
 * Diagnostic tool to verify Client 1 credentials safely.
 * This should ONLY be used for the requested audit and removed immediately after.
 */
export async function auditClientAuth(email: string, password: string) {
  console.log(`[AUDIT] Starting authentication test for: ${email}`);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(`[AUDIT] Result: FAIL`);
      console.log(`[AUDIT] Error Code: ${error.code}`);
      console.log(`[AUDIT] Error Message: ${error.message}`);
      return {
        success: false,
        code: error.code,
        message: error.message
      };
    }

    console.log(`[AUDIT] Result: SUCCESS`);
    console.log(`[AUDIT] Returned User ID: ${data.user?.id}`);
    
    // Safety check: signOut immediately to not leave a session
    await supabase.auth.signOut();
    
    return {
      success: true,
      returnedUserId: data.user?.id
    };
  } catch (err: any) {
    console.log(`[AUDIT] Crash during auth test:`, err);
    return {
      success: false,
      message: err.message
    };
  }
}
