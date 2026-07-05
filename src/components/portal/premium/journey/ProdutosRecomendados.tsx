import * as React from "react";
import { motion } from "framer-motion";
import { Package, Sparkles, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  products: any[];
  sales: any[];
};

const dispatch = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("OPEN_PRODUCTS_TAB"));
};

export function ProdutosRecomendados({ products, sales }: Props) {
  if (!products?.length) return null;

  // Scoring: products in categories the client bought before rank higher.
  const boughtCategories = new Set<string>();
  const boughtIds = new Set<string>();
  (sales || []).forEach((s) => {
    if (s.category) boughtCategories.add(String(s.category).toLowerCase());
    if (s.product?.category) boughtCategories.add(String(s.product.category).toLowerCase());
    if (s.product_id) boughtIds.add(s.product_id);
  });

  const scored = products
    .filter((p) => p?.active !== false && !boughtIds.has(p.id))
    .map((p) => {
      let score = 0;
      const cat = String(p.category || "").toLowerCase();
      if (cat && boughtCategories.has(cat)) score += 3;
      if (p.featured) score += 2;
      if (Number(p.stock_quantity || 1) > 0) score += 1;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!scored.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Curadoria Barbex</p>
          <h3 className="text-lg md:text-xl font-black text-white mt-1">Produtos recomendados</h3>
        </div>
        <button
          type="button"
          onClick={dispatch}
          className="hidden md:inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-[#D4AF37] hover:text-[#F5D061] transition-colors"
        >
          Ver catálogo →
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {scored.map(({ p }, i) => {
          const img = p.image_url || p.thumbnail_url || p.images?.[0]?.url;
          const price = Number(p.price || 0);
          return (
            <motion.button
              key={p.id}
              type="button"
              onClick={dispatch}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]",
                "text-left backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#D4AF37]/45",
                "hover:shadow-[0_12px_32px_-12px_rgba(212,175,55,0.4)]",
              )}
            >
              <div className="relative aspect-square bg-gradient-to-br from-white/5 to-transparent">
                {img ? (
                  <img src={img} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-white/30">
                    <Package className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-[9px] font-black uppercase tracking-widest text-[#D4AF37] border border-[#D4AF37]/40">
                  <Sparkles className="h-2.5 w-2.5" /> Para você
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-bold text-white truncate">{p.name}</p>
                {p.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-snug">{p.description}</p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-base font-black text-[#D4AF37]">R$ {price.toFixed(2)}</p>
                  <span className="text-[10px] uppercase tracking-widest font-black text-white/70 flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Ver
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}
