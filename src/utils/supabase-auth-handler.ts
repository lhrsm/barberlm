import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Checks if an error is related to authentication or session expiration.
 */
export const isAuthError = (error: any): boolean => {
  if (!error) return false;
  
  const message = (error.message || "").toLowerCase();
  const code = (error.code || "").toLowerCase();
  
  return (
    message.includes("jwt expired") ||
    message.includes("invalid jwt") ||
    message.includes("session expired") ||
    message.includes("refresh token expired") ||
    code === "pgrst_auth_failed" ||
    error.status === 401
  );
};

/**
 * Attempts to refresh the session and retry the operation.
 */
export async function handleSupabaseAuthError<T>(
  error: any,
  retryFn: () => Promise<T>
): Promise<T> {
  if (!isAuthError(error)) {
    throw error;
  }

  console.warn("[AuthHandler] JWT expired or invalid. Attempting to refresh session...");

  try {
    const { data, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !data.session) {
      throw new Error("Session recovery failed");
    }

    console.log("[AuthHandler] Session refreshed successfully. Retrying operation...");
    return await retryFn();
  } catch (recoveryError) {
    console.error("[AuthHandler] Critical auth error, redirecting to login:", recoveryError);
    
    // Clear storage to avoid inconsistent states
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname + window.location.search;
      localStorage.removeItem("supabase.auth.token");
      sessionStorage.clear();
      
      toast.error("Sua sessão expirou. Faça login novamente para continuar.", {
        id: "auth-expired-toast",
      });

      // Redirect to login with redirect parameter
      window.location.href = `/auth?redirect=${encodeURIComponent(currentPath)}`;
    }
    
    throw recoveryError;
  }
}
