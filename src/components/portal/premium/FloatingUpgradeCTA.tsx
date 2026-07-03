import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, X, ArrowRight, Sparkles, Wallet, Zap, CreditCard } from "lucide-react";

type Props = {
  onSubscribe: () => void;
};

const BADGES = [
  { icon: Sparkles, label: "Serviços inclusos" },
  { icon: Wallet, label: "Cashback" },
  { icon: Zap, label: "Prioridade" },
  { icon: CreditCard, label: "Cartão digital" },
];

export function FloatingUpgradeCTA({ onSubscribe }: Props) {
  const [visible, setVisible] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() =>
    typeof window !== "undefined" && sessionStorage.getItem("barbex_cta_dismissed") === "1"
  );

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("barbex_cta_dismissed", "1");
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-3xl"
        >
          <div
            className="relative overflow-hidden rounded-[18px] border border-[#D4AF37]/40 bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#0A0A0A] shadow-[0_20px_60px_-15px_rgba(212,175,55,0.35)]"
            style={{ padding: "18px 24px" }}
          >
            {/* Glow ambient */}
            <div className="pointer-events-none absolute -top-24 -left-16 h-48 w-48 rounded-full bg-[#D4AF37]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-[#F5D061]/10 blur-3xl" />

            {/* Close (mobile: top-right / desktop: far right column) */}
            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              className="absolute top-3 right-3 md:hidden h-[30px] w-[30px] rounded-full border border-[#D4AF37]/40 bg-transparent grid place-items-center text-[#D4AF37] hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-400 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="relative flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              {/* LEFT: icon + title */}
              <div className="flex items-center gap-3 min-w-0 md:shrink-0">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#F5D061] grid place-items-center shrink-0 shadow-[0_0_24px_rgba(212,175,55,0.45)]">
                  <Crown className="h-5.5 w-5.5 text-black" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] md:text-base font-black text-white leading-tight">
                    Economize até R$ 300 por mês
                  </p>
                  <p className="text-[11px] md:text-xs text-[#D4AF37]/80 mt-0.5 font-semibold tracking-wide">
                    Com o Clube Barbex Premium
                  </p>
                </div>
              </div>

              {/* CENTER: badges */}
              <div className="flex flex-wrap gap-1.5 md:gap-2 md:flex-1 md:justify-center">
                {BADGES.map((b) => {
                  const Icon = b.icon;
                  return (
                    <span
                      key={b.label}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] text-[10.5px] font-bold text-[#F5D061] whitespace-nowrap"
                    >
                      <Icon className="h-3 w-3" />
                      {b.label}
                    </span>
                  );
                })}
              </div>

              {/* RIGHT: CTA + close (desktop) */}
              <div className="flex items-center gap-2 md:shrink-0 w-full md:w-auto">
                <button
                  onClick={onSubscribe}
                  className="group inline-flex items-center justify-center gap-2 w-full md:w-auto text-black font-extrabold text-[13px] bg-gradient-to-r from-[#D4AF37] to-[#F5D061] hover:shadow-[0_0_28px_rgba(212,175,55,0.6)] hover:scale-[1.03] active:scale-[0.99] transition-all duration-200 whitespace-nowrap"
                  style={{ height: 42, borderRadius: 14, padding: "0 22px", fontWeight: 800 }}
                >
                  Conhecer Planos
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  onClick={handleDismiss}
                  aria-label="Fechar"
                  className="hidden md:grid h-[30px] w-[30px] rounded-full border border-[#D4AF37]/40 bg-transparent place-items-center text-[#D4AF37] hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
