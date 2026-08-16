import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  Calendar,
  Clock,
  Zap
} from "lucide-react";
import { getServiceTrends } from "../../lib/marketing-ai.functions";
import { cn } from "@/lib/utils";

interface PredictiveTrendsProps {
  tenantId: string;
}

export function PredictiveTrends({ tenantId }: PredictiveTrendsProps) {
  const { data: trends, isLoading } = useQuery({
    queryKey: ["service-predictive-trends", tenantId],
    queryFn: () => getServiceTrends({ data: { tenantId } }),
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  if (isLoading) return null;

  return (
    <div className="rounded-[2rem] border border-white/[0.06] bg-[#0b0f17] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <Activity size={16} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Tendências Preditivas</h3>
          <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">IA Analítica de Serviços</p>
        </div>
      </div>

      <div className="space-y-3">
        {trends?.map((item: any, idx: number) => (
          <motion.div
            key={item.service}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                item.trend === "up" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              )}>
                {item.trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </div>
              <div>
                <p className="text-xs font-bold text-white">{item.service}</p>
                <p className="text-[9px] text-white/40">{item.insight}</p>
              </div>
            </div>
            <div className={cn(
              "text-xs font-black",
              item.trend === "up" ? "text-emerald-400" : "text-rose-400"
            )}>
              {item.trend === "up" ? "+" : "-"}{item.change}%
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-white/[0.06] grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-white/40 uppercase tracking-widest">
            <Calendar size={10} className="text-gold" />
            Melhor Dia
          </div>
          <p className="text-xs font-bold text-white">Sábado</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-white/40 uppercase tracking-widest">
            <Clock size={10} className="text-gold" />
            Horário Pico
          </div>
          <p className="text-xs font-bold text-white">10:00 - 14:00</p>
        </div>
      </div>
    </div>
  );
}
