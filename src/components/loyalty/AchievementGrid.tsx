import React from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  unlocked?: boolean;
  unlocked_at?: string;
  category: string;
}

interface AchievementGridProps {
  achievements: Achievement[];
  className?: string;
}

export function AchievementGrid({ achievements, className }: AchievementGridProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {achievements.map((achievement) => {
        const IconComp = (LucideIcons as any)[achievement.icon] || LucideIcons.Award;
        
        return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -5 }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300",
              achievement.unlocked 
                ? "border-gold/30 bg-gold/5 shadow-lg shadow-gold/5" 
                : "border-white/5 bg-zinc-900/50 opacity-75 grayscale hover:grayscale-[50%] hover:opacity-100"
            )}
          >
            {achievement.unlocked && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="h-4 w-4 text-gold" />
              </div>
            )}
            {!achievement.unlocked && (
              <div className="absolute top-3 right-3">
                <Lock className="h-3 w-3 text-zinc-600" />
              </div>
            )}

            <div className="flex gap-4">
              <div 
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  achievement.unlocked 
                    ? "border-gold/30 bg-gold/10" 
                    : "border-white/10 bg-white/5"
                )}
              >
                <IconComp 
                  className={cn(
                    "h-6 w-6 transition-colors",
                    achievement.unlocked ? "text-gold" : "text-zinc-500"
                  )} 
                />
              </div>
              
              <div className="min-w-0 flex-1">
                <h4 className={cn(
                  "font-black uppercase italic tracking-tight text-sm mb-1 truncate",
                  achievement.unlocked ? "text-white" : "text-zinc-400"
                )}>
                  {achievement.name}
                </h4>
                <p className="text-xs text-zinc-500 leading-snug line-clamp-2">
                  {achievement.description}
                </p>
                
                <div className="mt-3 flex items-center justify-between">
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-[0.2em]",
                    achievement.unlocked ? "text-gold" : "text-zinc-600"
                  )}>
                    +{achievement.xp_reward} XP
                  </span>
                  {achievement.unlocked_at && (
                    <span className="text-[8px] text-zinc-600 font-medium">
                      {new Date(achievement.unlocked_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
