import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Package, Sparkles, Flame, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  products: any[];
  onView: (product: any) => void;
  onAdd: (product: any) => void;
  isInCart?: (product: any) => boolean;
}

/**
 * Vitrine de destaques da loja — camada 100% visual.
 * Reutiliza os produtos já carregados e os mesmos callbacks da loja atual
 * (ver produto / adicionar ao carrinho). Não altera checkout nem dados.
 */
export const StoreHighlights = memo(function StoreHighlights({ products, onView, onAdd, isInCart }: Props) {
  const highlights = useMemo(() => {
    const actives = (products || []).filter((p) => p.active);
    const scored = actives
      .map((p) => {
        let score = 0;
        if (p.badge) score += 3;
        if (p.promotional_price) score += 2;
        if (Number(p.stock_quantity) > 0) score += 1;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score || Number(b.p.price) - Number(a.p.price));
    return scored.slice(0, 3).map((s) => s.p);
  }, [products]);

  if (highlights.length === 0) return null;

  const tagFor = (p: any) => {
    if (p.badge) return { label: p.badge, icon: Tag };
    if (p.promotional_price) return { label: "Oferta", icon: Flame };
    return { label: "Destaque", icon: Sparkles };
  };

  return (
    <div className="mb-16">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">Destaques da loja</span>
        <span className="h-px flex-1 bg-gradient-to-r from-gold/30 to-transparent" />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {highlights.map((p, idx) => {
          const tag = tagFor(p);
          const TagIcon = tag.icon;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              viewport={{ once: true }}
              className={cn(
                "group relative flex gap-4 overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-zinc-950 to-black p-4 transition-all duration-300",
                "hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_20px_50px_rgba(245,197,66,0.15)]",
              )}
            >
              <button
                type="button"
                onClick={() => onView(p)}
                aria-label={`Ver ${p.name}`}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900"
              >
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-zinc-700">
                    <Package size={28} />
                  </span>
                )}
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="inline-flex w-fit items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gold">
                  <TagIcon size={10} /> {tag.label}
                </span>
                <h4 className="mt-1.5 truncate text-sm font-black uppercase tracking-tight text-white">{p.name}</h4>
                <p className="text-lg font-black text-gold">R$ {Number(p.price).toFixed(2)}</p>
                <div className="mt-auto flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="h-8 rounded-full border-gold/35 bg-transparent px-3 text-[10px] font-black uppercase tracking-widest text-gold hover:border-gold hover:bg-gold/10"
                    onClick={() => onView(p)}
                  >
                    Ver
                  </Button>
                  <Button
                    className="h-8 rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] px-3 text-[10px] font-black uppercase tracking-widest text-[#050505] hover:-translate-y-0.5"
                    onClick={() => onAdd(p)}
                  >
                    {isInCart?.(p) ? "Remover" : "Adicionar"}
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});
