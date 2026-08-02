import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type BeforeAfterItem = {
  title?: string;
  before?: string;
  after?: string;
};

interface BeforeAfterShowcaseProps {
  items?: unknown;
  shopName?: string;
}

function normalize(items: unknown): BeforeAfterItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is BeforeAfterItem =>
      !!i && typeof i === "object" && typeof (i as any).before === "string" && typeof (i as any).after === "string"
  );
}

function Slider({ item, shopName }: { item: BeforeAfterItem; shopName?: string }) {
  const [pos, setPos] = useState(50);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-gold/20 bg-[#0a0a0a] shadow-2xl">
      <div className="relative aspect-[4/5] select-none">
        <img
          src={item.after}
          alt={`Depois — ${item.title || shopName || "resultado"}`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img
            src={item.before}
            alt={`Antes — ${item.title || shopName || "resultado"}`}
            loading="lazy"
            className="h-full w-full object-cover"
            style={{ width: `${100 / (pos / 100 || 1)}%`, maxWidth: "none" }}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-gold shadow-[0_0_18px_rgba(212,175,55,0.8)]"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold bg-black/80 backdrop-blur flex items-center justify-center text-gold text-[10px] font-black">
            ↔
          </div>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70">
          Antes
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-gold/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
          Depois
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label={`Comparar antes e depois${item.title ? ` — ${item.title}` : ""}`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      {item.title && (
        <div className="px-5 py-4 border-t border-gold/10">
          <p className="text-sm font-black uppercase italic tracking-tight text-white">{item.title}</p>
        </div>
      )}
    </div>
  );
}

export function BeforeAfterShowcase({ items, shopName }: BeforeAfterShowcaseProps) {
  const list = normalize(items);
  if (list.length === 0) return null;

  return (
    <section id="antes-depois" className="py-24 bg-[#080808]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <span className="text-gold font-black uppercase tracking-[0.2em] text-sm">Transformações Reais</span>
          <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Antes & Depois</h3>
          <p className="text-white/50 text-sm max-w-xl mx-auto">
            Arraste a barra para ver o resultado do trabalho da nossa equipe.
          </p>
        </div>
        <div className={cn("grid gap-6", list.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-2 lg:grid-cols-3")}>
          {list.map((item, idx) => (
            <motion.div
              key={`${item.before}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (idx % 3) * 0.08 }}
            >
              <Slider item={item} shopName={shopName} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
