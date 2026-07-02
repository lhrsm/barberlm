import * as React from "react";
import { motion } from "framer-motion";
import { Award, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  appointments: any[];
  loyaltyPoints?: number;
};

const TIERS = [
  { name: "Bronze", min: 0, color: "#CD7F32", glow: "rgba(205,127,50,0.4)" },
  { name: "Prata", min: 5, color: "#C0C0C0", glow: "rgba(192,192,192,0.4)" },
  { name: "Ouro", min: 12, color: "#D4AF37", glow: "rgba(212,175,55,0.5)" },
  { name: "Diamante", min: 25, color: "#B9F2FF", glow: "rgba(185,242,255,0.5)" },
];

export function LoyaltyTierProgress({ appointments }: Props) {
  const completed = appointments.filter((a) => a.status === "completed").length;
  const currentIdx = [...TIERS].reverse().findIndex((t) => completed >= t.min);
  const currentTier = TIERS[TIERS.length - 1 - (currentIdx === -1 ? TIERS.length - 1 : currentIdx)];
  const nextTier = TIERS.find((t) => t.min > completed);
  const progress = nextTier
    ? Math.min(100, ((completed - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;
  const remaining = nextTier ? nextTier.min - completed : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6 md:p-8"
    >
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-40"
        style={{ background: currentTier.glow }}
      />
      <div className="relative flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">
            Programa de Fidelidade
          </p>
          <h2 className="text-xl md:text-2xl font-black text-white mt-1 flex items-center gap-2">
            <Award className="h-5 w-5" style={{ color: currentTier.color }} />
            Nível {currentTier.name}
          </h2>
        </div>
        <div
          className="px-4 py-2 rounded-xl border font-black text-sm"
          style={{
            borderColor: currentTier.color + "60",
            background: currentTier.color + "15",
            color: currentTier.color,
            boxShadow: `0 8px 24px ${currentTier.glow}`,
          }}
        >
          {completed} atendimentos
        </div>
      </div>

      <div className="relative">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {TIERS.map((t) => {
            const active = completed >= t.min;
            return (
              <div key={t.name} className="text-center">
                <div
                  className={cn(
                    "mx-auto h-8 w-8 rounded-full grid place-items-center transition-all",
                    active ? "scale-100" : "scale-90 opacity-50",
                  )}
                  style={{
                    background: active ? t.color + "25" : "rgba(255,255,255,0.05)",
                    border: `1.5px solid ${active ? t.color : "rgba(255,255,255,0.15)"}`,
                    boxShadow: active ? `0 0 20px ${t.glow}` : "none",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" style={{ color: active ? t.color : "#666" }} />
                </div>
                <p
                  className={cn("mt-1.5 text-[10px] uppercase tracking-wider font-black")}
                  style={{ color: active ? t.color : "#666" }}
                >
                  {t.name}
                </p>
                <p className="text-[9px] text-gray-500">{t.min}+</p>
              </div>
            );
          })}
        </div>

        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier?.color || currentTier.color})`,
              boxShadow: `0 0 12px ${currentTier.glow}`,
            }}
          />
        </div>

        <p className="mt-4 text-sm text-gray-300 text-center">
          {nextTier ? (
            <>
              Faltam <span className="font-black text-[#D4AF37]">{remaining}</span>{" "}
              {remaining === 1 ? "visita" : "visitas"} para desbloquear{" "}
              <span className="font-black" style={{ color: nextTier.color }}>
                {nextTier.name}
              </span>
            </>
          ) : (
            <>Você atingiu o nível máximo. Parabéns!</>
          )}
        </p>
      </div>
    </motion.div>
  );
}
