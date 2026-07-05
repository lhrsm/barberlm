import * as React from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ShoppingBag,
  Wallet,
  Coins,
  RefreshCcw,
  Crown,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  hasCashback: boolean;
  hasCredits: boolean;
  isSubscriber: boolean;
  subscriptionsEnabled: boolean;
};

const dispatch = (event: string) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(event));
};

export function QuickActions({ hasCashback, hasCredits, isSubscriber, subscriptionsEnabled }: Props) {
  const actions = [
    { id: "book", label: "Agendar", icon: CalendarIcon, event: "OPEN_BOOKING_MODAL", accent: "gold", show: true },
    { id: "products", label: "Comprar produtos", icon: ShoppingBag, event: "OPEN_PRODUCTS_TAB", accent: "white", show: true },
    { id: "cashback", label: "Usar cashback", icon: Wallet, event: "OPEN_BOOKING_MODAL", accent: "emerald", show: hasCashback },
    { id: "credits", label: "Usar créditos", icon: Coins, event: "OPEN_BOOKING_MODAL", accent: "emerald", show: hasCredits },
    { id: "renew", label: "Ver assinatura", icon: RefreshCcw, event: "OPEN_PLAN_DETAILS_MODAL", accent: "gold", show: isSubscriber },
    { id: "change", label: "Alterar plano", icon: Crown, event: "OPEN_PLAN_DETAILS_MODAL", accent: "gold", show: isSubscriber },
    { id: "subscribe", label: "Conhecer planos", icon: Crown, event: "OPEN_SUBSCRIBE_MODAL", accent: "gold", show: !isSubscriber && subscriptionsEnabled },
    { id: "promos", label: "Ver promoções", icon: Gift, event: "OPEN_LOYALTY_MODAL", accent: "gold", show: true },
  ].filter((a) => a.show);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
    >
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Ação rápida</p>
        <h3 className="text-lg md:text-xl font-black text-white mt-1">O que deseja fazer hoje?</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {actions.map((a, i) => (
          <motion.button
            key={a.id}
            type="button"
            onClick={() => dispatch(a.event)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border p-3.5 text-left backdrop-blur transition-all",
              "bg-white/[0.02] border-white/10 hover:-translate-y-0.5",
              a.accent === "gold" && "hover:border-[#D4AF37]/50 hover:shadow-[0_8px_28px_-12px_rgba(212,175,55,0.4)]",
              a.accent === "emerald" && "hover:border-emerald-500/40",
              a.accent === "white" && "hover:border-white/25",
            )}
          >
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl grid place-items-center",
                a.accent === "gold" && "bg-[#D4AF37]/15 text-[#D4AF37]",
                a.accent === "emerald" && "bg-emerald-500/15 text-emerald-400",
                a.accent === "white" && "bg-white/10 text-white/80",
              )}
            >
              <a.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-white leading-tight">{a.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
