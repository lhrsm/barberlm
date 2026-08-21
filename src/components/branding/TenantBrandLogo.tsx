import * as React from "react";
import { Scissors } from "lucide-react";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { cn } from "@/lib/utils";

export interface TenantBrandLogoProps {
  tenantIdOrSlug?: string | null;
  shop?: any;
  size?: "sm" | "md" | "lg" | "xl" | "responsive";
  className?: string;
  imageClassName?: string;
  shape?: "rounded" | "circle";
  priority?: "barbershop" | "avatar";
}

const SIZE_STYLES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-xl",
  responsive: "h-10 w-10 sm:h-12 sm:w-12 text-xs sm:text-sm",
};

export function TenantBrandLogo({
  tenantIdOrSlug,
  shop,
  size = "responsive",
  className = "",
  imageClassName = "",
  shape = "rounded",
}: TenantBrandLogoProps) {
  const [hasImgError, setHasImgError] = React.useState(false);

  const branding = useTenantBranding(tenantIdOrSlug || shop?.id || shop?.slug, shop);

  const effectiveLogoUrl = shop?.barbershop_logo_url || shop?.logo_url || shop?.avatar_url || branding.logoUrl;
  const effectiveInitials = branding.initials || (shop?.business_name ? shop.business_name.slice(0, 2).toUpperCase() : "");

  // Reset error when logo URL changes
  React.useEffect(() => {
    setHasImgError(false);
  }, [effectiveLogoUrl]);

  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.responsive;
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-2xl";

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden shrink-0 shadow-lg border border-gold/30 bg-gradient-to-br from-gold/20 to-transparent",
        sizeClass,
        shapeClass,
        className
      )}
    >
      {effectiveLogoUrl && !hasImgError ? (
        <img
          src={effectiveLogoUrl}
          alt={branding.businessName || "Logo da Barbearia"}
          className={cn("h-full w-full object-cover", shapeClass, imageClassName)}
          onError={() => setHasImgError(true)}
        />
      ) : effectiveInitials ? (
        <span className="text-gold font-black tracking-wider uppercase select-none">
          {effectiveInitials}
        </span>
      ) : (
        <Scissors className="h-5 w-5 text-gold" />
      )}
    </div>
  );
}
