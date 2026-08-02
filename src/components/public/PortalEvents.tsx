import { motion } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";

export type PortalEventItem = {
  title?: string;
  date?: string;
  description?: string;
  image?: string;
  location?: string;
};

function normalize(items: unknown): PortalEventItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is PortalEventItem => !!i && typeof i === "object" && typeof (i as any).title === "string" && !!(i as any).title
  );
}

function formatDate(value?: string) {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function PortalEvents({ items }: { items?: unknown }) {
  const list = normalize(items);
  if (list.length === 0) return null;

  return (
    <section id="eventos" className="py-24 bg-[#050505]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <span className="text-gold font-black uppercase tracking-[0.2em] text-sm">Agenda da Casa</span>
          <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Eventos</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((event, idx) => (
            <motion.article
              key={`${event.title}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (idx % 3) * 0.08 }}
              className="group overflow-hidden rounded-3xl border border-gold/15 bg-[#0a0a0a] shadow-2xl hover:border-gold/50 transition-colors"
            >
              {event.image && (
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-6 space-y-3">
                {formatDate(event.date) && (
                  <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gold">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDate(event.date)}
                  </p>
                )}
                <h4 className="text-xl font-black uppercase italic tracking-tight text-white">{event.title}</h4>
                {event.description && <p className="text-sm text-white/60 leading-relaxed">{event.description}</p>}
                {event.location && (
                  <p className="inline-flex items-center gap-2 text-xs text-white/40">
                    <MapPin className="h-3.5 w-3.5" /> {event.location}
                  </p>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
