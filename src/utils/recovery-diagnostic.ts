import { supabase } from '../integrations/supabase/client';

async function runRecoveryDiagnostic() {
  console.log("Starting Recovery Flow Diagnostic for louishenrique19@hotmail.com...");
  
  // This test checks if we can initiate a reset for the specific email
  const { data, error } = await supabase.auth.resetPasswordForEmail('louishenrique19@hotmail.com', {
    redirectTo: `${window.location.origin}/auth/reset-password`
  });

  if (error) {
    console.error("Recovery Initiation Failed:", error.message);
  } else {
    console.log("Recovery Initiation Success (Email sent if user exists and is confirmed).");
  }
}

// @ts-ignore
window.runRecoveryDiagnostic = runRecoveryDiagnostic;
console.log("Diagnostic utility registered: window.runRecoveryDiagnostic()");
