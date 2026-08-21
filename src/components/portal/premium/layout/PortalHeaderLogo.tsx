import * as React from "react";
import { Scissors } from "lucide-react";

interface PortalHeaderLogoProps {
  shop: any;
  slug?: string;
  className?: string;
}

/**
 * Canonical Logo component for the Customer Portal (Subscribers & Non-subscribers).
 * Renders the real barbershop logo (barbershop_logo_url || logo_url) with fallback
 * to business initials or stylized icon on image load error or missing logo.
 */
export function PortalHeaderLogo({ shop, slug = "", className = "" }: PortalHeaderLogoProps) {
  const [imgError, setImgError] = React.useState(false);
  const logoUrl = shop?.barbershop_logo_url || shop?.logo_url;
  const name = shop?.business_name || (slug ? slug.toUpperCase() : "");
  const initials = name
    ? name
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <div
      className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg ${className}`}
    >
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={name || "Logo da Barbearia"}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : initials ? (
        <span className="text-gold font-black text-xs sm:text-sm tracking-wider">
          {initials}
        </span>
      ) : (
        <Scissors className="h-5 w-5 text-gold" />
      )}
    </div>
  );
}
