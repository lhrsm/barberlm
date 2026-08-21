import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantBranding {
  tenantId: string | null;
  businessName: string;
  slug: string;
  logoUrl: string | null;
  barbershopLogoUrl: string | null;
  avatarUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  initials: string;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

function computeInitials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Canonical hook for resolving tenant branding across all user roles and portal views.
 * Supports resolution by tenantId (UUID) or by slug (public routes).
 */
export function useTenantBranding(tenantIdOrSlug?: string | null, initialShop?: any): TenantBranding {
  const qc = useQueryClient();

  const isUuid = Boolean(
    tenantIdOrSlug &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantIdOrSlug)
  );

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["tenant-branding", tenantIdOrSlug || "current"],
    queryFn: async () => {
      if (!tenantIdOrSlug) return null;
      let query = supabase
        .from("profiles")
        .select("id, business_name, slug, logo_url, barbershop_logo_url, avatar_url, primary_color, secondary_color");

      if (isUuid) {
        query = query.eq("id", tenantIdOrSlug);
      } else {
        query = query.eq("slug", tenantIdOrSlug);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(tenantIdOrSlug),
    initialData: initialShop ? {
      id: initialShop.id,
      business_name: initialShop.business_name,
      slug: initialShop.slug,
      logo_url: initialShop.logo_url,
      barbershop_logo_url: initialShop.barbershop_logo_url,
      avatar_url: initialShop.avatar_url,
      primary_color: initialShop.primary_color,
      secondary_color: initialShop.secondary_color,
    } : undefined,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const effectiveData = profile || initialShop || null;

  const businessName = effectiveData?.business_name || (tenantIdOrSlug && !isUuid ? tenantIdOrSlug.toUpperCase() : "Barbex");
  const barbershopLogoUrl = effectiveData?.barbershop_logo_url || null;
  const rawLogoUrl = effectiveData?.logo_url || null;
  const avatarUrl = effectiveData?.avatar_url || null;
  const logoUrl = barbershopLogoUrl || rawLogoUrl || avatarUrl || null;
  const primaryColor = effectiveData?.primary_color || "#fe9a00";
  const secondaryColor = effectiveData?.secondary_color || "#f4f4f5";
  const initials = computeInitials(businessName);

  return {
    tenantId: effectiveData?.id || (isUuid ? tenantIdOrSlug : null),
    businessName,
    slug: effectiveData?.slug || (!isUuid ? tenantIdOrSlug || "" : ""),
    logoUrl,
    barbershopLogoUrl,
    avatarUrl,
    primaryColor,
    secondaryColor,
    initials,
    isLoading,
    isError,
    refetch,
  };
}
