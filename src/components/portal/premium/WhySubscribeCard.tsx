import * as React from "react";
import { motion } from "framer-motion";
import { TrendingDown, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  appointments: any[];
  shopId?: string;
  onSubscribe: () => void;
};

export function WhySubscribeCard({ appointments, shopId, onSubscribe }: Props) {
  const [cheapestPlan, setCheapestPlan] = React.useState<any>(null);

  React.useEffect(() => {
    if (!shopId) return;
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("name, monthly_price")
        .eq("tenant_id", shopId)
        .eq("active", true)
        .order("monthly_price", { ascending: true })
        .limit(1);
      setCheapestPlan(data?.[0] || null);
    })();
  }, [shopId]);

  const completed = appointments.filter((a) => a.status === "completed");
  const totalSpent = completed.reduce((s, a) => s + Number(a.service_price || a.total_price || 0), 0);
  const avgPerVisit = completed.length ? totalSpent / completed.length : 60;
  const monthlyVisits = 2;
  const monthlyCost = avgPerVisit * monthlyVisits;
  const planPrice = Number(cheapestPlan?.monthly_price || 79.9);
  const savings = Math.max(0, monthlyCost - planPrice);
  const yearlySavings = savings * 12;

  if (savings <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-[#0A0A0A] to-black p-6 md:p-8"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-3">
          <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-emerald-400">
            Por que assinar?
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-white">
          Você poderia estar economizando{" "}
          <span className="text-emerald-400">R$ {savings.toFixed(0)}</span> por mês
        </h2>

        <div className="mt-6 grid md:grid-cols-3 gap-4 items-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Hoje</p>
            <p className="mt-2 text-3xl font-black text-white">R$ {monthlyCost.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-1">por mês em atendimentos</p>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <ArrowRight className="h-8 w-8 text-[#D4AF37]" />
          </div>

          <div className="rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#D4AF37]/10 to-transparent p-5 text-center shadow-[0_10px_30px_-10px_rgba(212,175,55,0.4)]">
            <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-black">Assinando</p>
            <p className="mt-2 text-3xl font-black text-[#D4AF37]">R$ {planPrice.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {cheapestPlan?.name || "Plano"} • ilimitado
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between flex-wrap gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4">
          <div>
            <p className="text-xs text-emerald-300 uppercase tracking-widest font-black">
              Economia anual estimada
            </p>
            <p className="text-2xl font-black text-emerald-400">R$ {yearlySavings.toFixed(0)}</p>
          </div>
          <button
            onClick={onSubscribe}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black font-black uppercase tracking-widest text-xs shadow-[0_8px_24px_rgba(212,175,55,0.4)] hover:-translate-y-0.5 transition-all"
          >
            <Sparkles className="h-4 w-4" /> Quero Economizar
          </button>
        </div>
      </div>
    </motion.div>
  );
}
