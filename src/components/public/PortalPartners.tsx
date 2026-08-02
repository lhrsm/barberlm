import { motion } from "framer-motion";

export type PortalPartnerItem = {
  name?: string;
  logo?: string;
  url?: string;
};

function normalize(items: unknown): PortalPartnerItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is PortalPartnerItem => !!i && typeof i === "object" && typeof (i as any).name === "string" && !!(i as any).name
  );
}

export function PortalPartners({ items }: { items?: unknown }) {
  const list = normalize(items);
  if (list.length === 0) return null;

  return (
    <section id="parceiros" className="py-20 bg-[#080808] border-y border-gold/10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center space-y-3 mb-12">
          <span className="text-gold font-black uppercase tracking-[0.2em] text-sm">Quem caminha com a gente</span>
          <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Parceiros</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {list.map((partner, idx) => {
            const inner = (
              <div className="flex h-28 items-center justify-center rounded-2xl border border-gold/15 bg-[#0a0a0a] px-4 transition-all hover:border-gold/50 hover:bg-[#0f0f0f]">
                {partner.logo ? (
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    loading="lazy"
                    className="max-h-14 w-auto object-contain opacity-70 transition-opacity hover:opacity-100"
                  />
                ) : (
                  <span className="text-center text-sm font-black uppercase tracking-widest text-white/60">{partner.name}</span>
                )}
              </div>
            );
            return (
              <motion.div
                key={`${partner.name}-${idx}`}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (idx % 4) * 0.06 }}
              >
                {partner.url ? (
                  <a href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={partner.name}>
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
