import React from "react";
import { motion } from "framer-motion";
import { Trophy, Star, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

interface LoyaltyLevel {
  id: string;
  name: string;
  min_xp: number;
  icon: string;
  color: string;
  benefits: string[];
}

interface LoyaltyLevelCardProps {
  currentXP: number;
  currentLevel?: LoyaltyLevel;
  nextLevel?: LoyaltyLevel;
  achievementsCount: number;
  className?: string;
}

export function LoyaltyLevelCard({
  currentXP,
  currentLevel,
  nextLevel,
  achievementsCount,
  className,
}: LoyaltyLevelCardProps) {
  const progress = nextLevel
    ? Math.min(100, Math.max(0, ((currentXP - (currentLevel?.min_xp ?? 0)) / ((nextLevel.min_xp ?? 1) - (currentLevel?.min_xp ?? 0))) * 100))
    : 100;

  const LevelIcon = currentLevel?.icon ? (LucideIcons as any)[currentLevel.icon] || Trophy : Trophy;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[2rem] border border-gold/20 bg-gradient-to-br from-zinc-900 to-black p-6 shadow-[0_20px_50px_-12px_rgba(212,175,55,0.15)]",
      className
    )}>
      {/* Background Decorative elements */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/5 blur-3xl" />
      <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-gold/5 blur-3xl" />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/30 shadow-lg shadow-gold/10"
              style={{ backgroundColor: `${currentLevel?.color || '#d4af37'}15` }}
            >
              <LevelIcon 
                className="h-8 w-8" 
                style={{ color: currentLevel?.color || '#d4af37' }} 
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-gold">Status Atual</span>
                <Sparkles className="h-3 w-3 text-gold" />
              </div>
              <h3 className="text-3xl font-black uppercase italic italic tracking-tighter text-white">
                Nível {currentLevel?.name || "Bronze"}
              </h3>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">{currentXP} XP</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pontos Acumulados</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
            <span>{currentLevel?.min_xp || 0} XP</span>
            {nextLevel && <span>Faltam {nextLevel.min_xp - currentXP} XP para o próximo nível</span>}
            <span>{nextLevel?.min_xp || 'MAX'} XP</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800/50 p-[2px] border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-gold via-amber-400 to-gold shadow-[0_0_15px_rgba(212,175,55,0.5)]"
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10">
            <div className="mb-1 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Conquistas</span>
            </div>
            <div className="text-xl font-black text-white">{achievementsCount} Desbloqueadas</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10">
            <div className="mb-1 flex items-center gap-2">
              <Star className="h-4 w-4 text-gold" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Benefícios Ativos</span>
            </div>
            <div className="text-xl font-black text-white">{currentLevel?.benefits.length || 0} Vantagens VIP</div>
          </div>
        </div>
      </div>
    </div>
  );
}
