import { useAuth } from "./use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";

let lastResolvedUserTenant: { userId: string; tenantId: string } | null = null;

export function useTenant() {
  const { user, profile, loading: authLoading, initialized: authInitialized } = useAuth();
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
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // The actual tenant ID being viewed/managed
  // Order of priority: 
  // 1. Impersonation (Super Admin)
  // 2. Explicit Membership (V2 Architecture)
  // 3. Super Admin default (null)
  // 4. Role-based fallback (Legacy Architecture)
  const candidateTenantId = impersonatedId ||
       membership?.tenant_id ||
       (profile?.tenant_id ||
        (profile?.role === 'admin' || profile?.role === 'tenant_admin' ? profile?.id || user?.id : (session?.tenant_id || null)));

  if (user?.id && candidateTenantId) {
    lastResolvedUserTenant = { userId: user.id, tenantId: candidateTenantId };
  } else if (!user) {
    lastResolvedUserTenant = null;
  }

  // Preserve last resolved tenant ID if auth is revalidating in background for the SAME authenticated user
  const tenantId = candidateTenantId || (user?.id && lastResolvedUserTenant?.userId === user.id ? lastResolvedUserTenant.tenantId : null);

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
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
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
    enabled: !!tenantProfile?.plan,
    staleTime: 5 * 60 * 1000,
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

  const isInitialLoading = (!authInitialized && !tenantId) || (!!tenantId && !tenantProfile && queryLoading);

  return {
    tenantId,
    tenantProfile,
    planDetails,
    membership,
    isLoading: isInitialLoading,
    isFeatureEnabled,
    getLimit,
    isImpersonating: !!impersonatedId,
    stopImpersonation
  };
}
