import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, 
  TrendingUp, 
  Target, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { getPredictiveRecommendations } from "@/lib/marketing-ai.functions";

interface MarketingAIAdvisorProps {
  tenantId: string;
}

export function MarketingAIAdvisor({ tenantId }: MarketingAIAdvisorProps) {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["predictive-recommendations", tenantId],
    queryFn: () => getPredictiveRecommendations({ data: { tenantId } }),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-3xl border border-white/[0.05] bg-white/[0.02]">
        <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
        <p className="text-sm font-bold text-white/40 uppercase tracking-widest">IA analisando dados do negócio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center">
            <BrainCircuit size={16} className="text-gold" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Barbex AI Advisor</h3>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Recomendações Preditivas de Alto Impacto</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1">
          <ShieldCheck size={12} className="text-emerald-400" />
          <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Motor de IA Ativo</span>
        </div>
      </div>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {recommendations?.map((rec: any, idx: number) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:border-gold/30 hover:bg-white/[0.04]",
                rec.impact === "Muito Alto" && "border-gold/20 bg-gold/[0.02]"
              )}
            >
              {/* Decorative gradient for high impact */}
              {rec.impact === "Muito Alto" && (
                <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gold/5 blur-3xl group-hover:bg-gold/10 transition-colors" />
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
                    rec.impact === "Muito Alto" ? "border-gold/30 bg-gold/10" : "border-white/10 bg-white/5"
                  )}>
                    {rec.type === 'retention' && <Zap size={20} className="text-gold" />}
                    {rec.type === 'inventory' && <AlertCircle size={20} className="text-amber-400" />}
                    {rec.type === 'loyalty' && <Target size={20} className="text-emerald-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                        rec.impact === "Muito Alto" ? "bg-gold text-black" : "bg-white/10 text-white/60"
                      )}>
                        Impacto {rec.impact}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-white/40">
                        <TrendingUp size={10} />
                        Score: {rec.score}%
                      </div>
                    </div>
                    <h4 className="text-sm font-black text-white">{rec.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed mt-0.5">{rec.description}</p>
                  </div>
                </div>

                <Button asChild className={cn(
                  "h-10 rounded-xl px-5 text-xs font-black transition-all",
                  rec.impact === "Muito Alto" 
                    ? "bg-gold text-black hover:bg-gold/90 shadow-[0_0_15px_rgba(212,175,55,0.3)]" 
                    : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                )}>
                  <Link to={rec.to}>
                    {rec.action}
                    <ArrowRight size={14} className="ml-2" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {(!recommendations || recommendations.length === 0) && (
          <div className="text-center py-8 rounded-2xl border border-dashed border-white/10">
            <Sparkles className="h-6 w-6 text-white/20 mx-auto mb-2" />
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest">Nenhuma recomendação crítica no radar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
