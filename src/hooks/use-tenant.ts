import { useAuth } from "./use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";

export function useTenant() {
  const { user, profile, loading: authLoading } = useAuth();
  const { session } = useProfessionalAuth();
  
  // Check for impersonation in sessionStorage
  const impersonatedId = typeof window !== 'undefined' ? sessionStorage.getItem("impersonated_tenant_id") : null;
  
  // 1. Check for explicit memberships
  const { data: membership } = useQuery({
    queryKey: ["tenant-membership", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id
  });

  // The actual tenant ID being viewed/managed
  // Order of priority: 
  // 1. Impersonation (Super Admin)
  // 2. Explicit Membership (V2 Architecture)
  // 3. Super Admin default (null)
  // 4. Role-based fallback (Legacy Architecture)
  const tenantId = authLoading 
    ? null 
    : (impersonatedId || 
       membership?.tenant_id || 
       (profile?.role === 'super_admin' ? null : 
        (profile?.tenant_id || 
         (profile?.role === 'tenant_admin' ? profile?.id || user?.id : (session?.tenant_id || null)))));

    if (typeof window !== 'undefined') {
      console.log("[useTenant] Debug:", { 
        tenantId, 
        role: profile?.role, 
        impersonatedId, 
        membershipTenantId: membership?.tenant_id,
        profileId: profile?.id, 
        professionalTenantId: session?.tenant_id 
      });
    }


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
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem("impersonated_tenant_id");
      window.location.href = "/admin/tenants";
    }
  };

  return {
    tenantId,
    tenantProfile,
    planDetails,
    membership,
    isLoading: authLoading || queryLoading,
    isFeatureEnabled,
    getLimit,
    isImpersonating: !!impersonatedId,
    stopImpersonation
  };
}
