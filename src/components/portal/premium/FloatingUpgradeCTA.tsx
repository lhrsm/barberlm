import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, X } from "lucide-react";

type Props = {
  onSubscribe: () => void;
};

export function FloatingUpgradeCTA({ onSubscribe }: Props) {
  const [visible, setVisible] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() =>
    typeof window !== "undefined" && sessionStorage.getItem("barbex_cta_dismissed") === "1"
  );

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl"
        >
          <div className="relative flex items-center gap-3 rounded-2xl border border-[#D4AF37]/40 bg-black/90 backdrop-blur-xl px-4 py-3 shadow-[0_20px_50px_-15px_rgba(212,175,55,0.5)]">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#F5D061] grid place-items-center shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
              <Crown className="h-5 w-5 text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white leading-tight truncate">
                Economize até R$ 300 por mês
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                Com o Clube Barbex Premium
              </p>
            </div>
            <button
              onClick={onSubscribe}
              className="hidden sm:inline-flex h-9 px-4 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black font-black uppercase tracking-widest text-[10px] whitespace-nowrap hover:brightness-110 transition-all"
            >
              Ver Planos
            </button>
            <button
              onClick={onSubscribe}
              className="sm:hidden inline-flex h-9 px-3 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black font-black uppercase tracking-widest text-[10px] whitespace-nowrap"
            >
              Ver
            </button>
            <button
              onClick={() => {
                setDismissed(true);
                sessionStorage.setItem("barbex_cta_dismissed", "1");
              }}
              className="h-7 w-7 rounded-lg grid place-items-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
