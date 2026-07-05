import * as React from "react";
import { motion } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";
import { PremiumHeroCard } from "@/components/portal/premium/PremiumHeroCard";

type Props = {
  client: any;
  shop: any;
  customerData: any;
  mySubscription: any;
  appointments: any[];
  onNewAppointment: () => void;
};

export function HeroJornada(props: Props) {
  return (
    <div className="space-y-4">
      <PremiumHeroCard
        client={props.client}
        shop={props.shop}
        customerData={props.customerData}
        mySubscription={props.mySubscription}
        appointments={props.appointments}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-r from-[#D4AF37]/[0.06] via-white/[0.02] to-transparent px-5 py-4 backdrop-blur-xl"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37] flex items-center gap-2">
            <Sparkles className="h-3 w-3" /> Sua experiência premium
          </p>
          <h2 className="text-xl md:text-2xl font-black text-white mt-0.5 truncate">Sua Jornada Barbex</h2>
        </div>
        <button
          type="button"
          onClick={props.onNewAppointment}
          className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-widest bg-[#D4AF37] text-black hover:brightness-110 transition-all shadow-[0_10px_30px_-10px_rgba(212,175,55,0.6)]"
        >
          <Plus className="h-4 w-4" /> Novo Agendamento
        </button>
      </motion.div>
    </div>
  );
}
