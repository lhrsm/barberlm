import { useAuth } from "./use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTenant() {
  const { user, profile, loading: authLoading } = useAuth();
  
  // Check for impersonation in sessionStorage
  const impersonatedId = typeof window !== 'undefined' ? sessionStorage.getItem("impersonated_tenant_id") : null;
  
  // The actual tenant ID being viewed/managed
  const tenantId = authLoading 
    ? null 
    : (impersonatedId || (profile?.role === 'super_admin' ? null : (profile?.tenant_id || (profile?.role === 'tenant_admin' ? profile?.id || user?.id : null))));

  console.log("[useTenant] Debug:", { tenantId, role: profile?.role, impersonatedId, profileId: profile?.id });


  const { data: tenantProfile, isLoading: queryLoading } = useQuery({
    queryKey: ["tenant-profile", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId
  });

  const { data: planDetails } = useQuery({
    queryKey: ["plan-details", tenantProfile?.plan],
    queryFn: async () => {
      if (!tenantProfile?.plan) return null;
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("name", tenantProfile.plan.toUpperCase())
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantProfile?.plan
  });

  const isFeatureEnabled = (featureKey: string) => {
    if (!planDetails) return false;
    return !!(planDetails.features as any)?.[featureKey];
  };

  const getLimit = (limitKey: string) => {
    if (!planDetails) return 0;
    return (planDetails.limits as any)?.[limitKey] ?? 0;
  };

  const stopImpersonation = () => {
    sessionStorage.removeItem("impersonated_tenant_id");
    window.location.href = "/admin/tenants";
  };

  return {
    tenantId,
    tenantProfile,
    planDetails,
    isLoading: authLoading || queryLoading,
    isFeatureEnabled,
    getLimit,
    isImpersonating: !!impersonatedId,
    stopImpersonation
  };
}
