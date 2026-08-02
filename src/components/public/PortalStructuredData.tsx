interface PortalStructuredDataProps {
  shop: any;
  slug: string;
  services?: any[];
  ratingAverage?: number | null;
  ratingCount?: number | null;
}

/**
 * Emits dynamic JSON-LD (events, gallery, services, rating) for the public
 * portal. Rendered inside the page body — valid per schema.org/Google.
 */
export function PortalStructuredData({ shop, slug, services, ratingAverage, ratingCount }: PortalStructuredDataProps) {
  if (!shop) return null;

  const baseUrl = `https://barbex.shop/${slug}`;
  const graph: any[] = [];

  const gallery: string[] = Array.isArray(shop.gallery_images) ? shop.gallery_images.filter(Boolean) : [];
  const events: any[] = Array.isArray(shop.portal_events) ? shop.portal_events : [];

  const business: any = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": `${baseUrl}#business`,
    name: shop.business_name,
    url: baseUrl,
    ...(shop.barbershop_logo_url || shop.logo_url ? { image: shop.barbershop_logo_url || shop.logo_url } : {}),
    ...(shop.address ? { address: { "@type": "PostalAddress", streetAddress: shop.address } } : {}),
    ...(shop.whatsapp_number ? { telephone: shop.whatsapp_number } : {}),
    ...(gallery.length ? { photo: gallery.slice(0, 12) } : {}),
  };

  if (ratingAverage && ratingCount) {
    business.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(ratingAverage.toFixed(1)),
      reviewCount: ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const offers = (services || []).filter((s) => s?.name).slice(0, 20);
  if (offers.length) {
    business.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: "Serviços",
      itemListElement: offers.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, ...(s.description ? { description: s.description } : {}) },
        ...(s.price != null ? { price: Number(s.price), priceCurrency: "BRL" } : {}),
      })),
    };
  }

  graph.push(business);

  events
    .filter((e) => e?.title && e?.date)
    .forEach((e) => {
      graph.push({
        "@context": "https://schema.org",
        "@type": "Event",
        name: e.title,
        startDate: e.date,
        ...(e.description ? { description: e.description } : {}),
        ...(e.image ? { image: e.image } : {}),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: e.location || shop.business_name,
          address: { "@type": "PostalAddress", streetAddress: e.location || shop.address || shop.business_name },
        },
        organizer: { "@type": "Organization", name: shop.business_name, url: baseUrl },
      });
    });

  if (gallery.length) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "ImageGallery",
      name: `Galeria — ${shop.business_name}`,
      url: `${baseUrl}#galeria`,
      image: gallery.slice(0, 20),
    });
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph.length === 1 ? graph[0] : graph) }}
    />
  );
}
