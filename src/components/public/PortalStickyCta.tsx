import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, MessageCircle } from "lucide-react";

interface PortalStickyCtaProps {
  onBook: () => void;
  whatsapp?: string | null;
  shopName?: string;
  label?: string;
}

/**
 * Mobile-only sticky conversion bar. Purely presentational: it reuses the
 * existing booking handler and the shop's WhatsApp number.
 */
export function PortalStickyCta({ onBook, whatsapp, shopName, label }: PortalStickyCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const digits = (whatsapp || "").replace(/\D/g, "");
  const waHref = digits
    ? `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}?text=${encodeURIComponent(
        `Olá${shopName ? `, ${shopName}` : ""}! Gostaria de mais informações.`
      )}`
    : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="md:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-3 pt-2 bg-gradient-to-t from-black via-black/95 to-transparent"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBook}
              className="flex-1 h-13 min-h-[52px] rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-black font-black uppercase tracking-wider text-sm shadow-[0_10px_28px_rgba(245,197,66,0.3)] flex items-center justify-center gap-2"
            >
              <CalendarCheck className="h-4 w-4" />
              {label || "Agendar agora"}
            </button>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Falar no WhatsApp"
                className="h-[52px] w-[52px] shrink-0 rounded-full bg-[#0B1324] border border-gold/40 text-gold flex items-center justify-center shadow-lg"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
