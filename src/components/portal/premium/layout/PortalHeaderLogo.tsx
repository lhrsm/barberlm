import * as React from "react";
import { TenantBrandLogo } from "@/components/branding/TenantBrandLogo";

export interface PortalHeaderLogoProps {
  shop: any;
  slug?: string;
  className?: string;
}

/**
 * Canonical Logo component for the Customer Portal (Subscribers & Non-subscribers).
 * Powered by TenantBrandLogo.
 */
export function PortalHeaderLogo({ shop, slug = "", className = "" }: PortalHeaderLogoProps) {
  return (
    <TenantBrandLogo
      tenantIdOrSlug={shop?.id || slug}
      shop={shop}
      size="responsive"
      className={className}
    />
  );
}
