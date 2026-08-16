import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, Target, AlertCircle, ArrowRight, ShieldCheck, BrainCircuit, Loader2, DollarSign, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { getPredictiveRecommendations, getRevenueProjections } from "@/lib/marketing-ai.functions";
import { brl } from "@/components/intelligence/engine";
export function MarketingAIAdvisor({ tenantId }) {
    const { data: recommendations, isLoading: loadingRecs } = useQuery({
        queryKey: ["predictive-recommendations", tenantId],
        queryFn: () => getPredictiveRecommendations({ data: { tenantId } }),
        staleTime: 1000 * 60 * 15,
    });
    const { data: projections, isLoading: loadingProjections } = useQuery({
        queryKey: ["revenue-projections", tenantId],
        queryFn: () => getRevenueProjections({ data: { tenantId } }),
        staleTime: 1000 * 60 * 30,
    });
    if (loadingRecs || loadingProjections) {
        return (<div className="flex flex-col items-center justify-center py-12 rounded-3xl border border-white/[0.05] bg-white/[0.02]">
        <Loader2 className="h-8 w-8 text-gold animate-spin mb-4"/>
        <p className="text-sm font-bold text-white/40 uppercase tracking-widest">IA analisando dados do negócio...</p>
      </div>);
    }
    return (<div className="space-y-6">
      {/* AI Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-gold/10 to-transparent p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-gold"/>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Potencial Recuperável</p>
          </div>
          <p className="text-2xl font-black text-white">{brl(projections?.recoverableRevenue || 0)}</p>
          <div className="mt-2 flex items-center gap-1">
             <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} className="h-full bg-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]"/>
             </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-blue-400"/>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Saúde Comercial</p>
          </div>
          <p className="text-2xl font-black text-white">{projections?.healthScore || 0}%</p>
          <p className="text-[9px] font-bold text-emerald-400 mt-1">+4% desde o mês passado</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={14} className="text-emerald-400"/>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Status do Motor IA</p>
          </div>
          <p className="text-2xl font-black text-white">Otimizado</p>
          <p className="text-[9px] font-bold text-white/40 mt-1">Última varredura: hoje</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <BrainCircuit size={16} className="text-gold"/>
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Recomendações da IA</h3>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ações para Maximização de ROI</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {recommendations?.map((rec, idx) => (<motion.div key={rec.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className={cn("group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:border-gold/30 hover:bg-white/[0.04]", rec.impact === "Muito Alto" && "border-gold/20 bg-gold/[0.02]")}>
                {rec.impact === "Muito Alto" && (<div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gold/5 blur-3xl group-hover:bg-gold/10 transition-colors"/>)}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors", rec.impact === "Muito Alto" ? "border-gold/30 bg-gold/10" : "border-white/10 bg-white/5")}>
                      {rec.type === 'retention' && <Zap size={20} className="text-gold"/>}
                      {rec.type === 'inventory' && <AlertCircle size={20} className="text-amber-400"/>}
                      {rec.type === 'loyalty' && <Target size={20} className="text-emerald-400"/>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md", rec.impact === "Muito Alto" ? "bg-gold text-black" : "bg-white/10 text-white/60")}>
                          Impacto {rec.impact}
                        </span>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-white/40">
                          <TrendingUp size={10}/>
                          ROI Est.: {rec.score}%
                        </div>
                        {rec.estimatedRevenue > 0 && (<div className="text-[9px] font-bold text-emerald-400">
                             + {brl(rec.estimatedRevenue)} est.
                          </div>)}
                      </div>
                      <h4 className="text-sm font-black text-white">{rec.title}</h4>
                      <p className="text-xs text-white/50 leading-relaxed mt-0.5">{rec.description}</p>
                    </div>
                  </div>

                  <Button asChild className={cn("h-10 rounded-xl px-5 text-xs font-black transition-all", rec.impact === "Muito Alto"
                ? "bg-gold text-black hover:bg-gold/90 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                : "bg-white/5 text-white hover:bg-white/10 border border-white/10")}>
                    <Link to={rec.to}>
                      {rec.action}
                      <ArrowRight size={14} className="ml-2"/>
                    </Link>
                  </Button>
                </div>
              </motion.div>))}
          </AnimatePresence>
        </div>
      </div>
    </div>);
}
