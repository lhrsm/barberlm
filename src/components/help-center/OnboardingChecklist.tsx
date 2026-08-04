import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  Trophy, 
  Minimize2, 
  Maximize2,
  Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { toast } from 'sonner';

export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  isOptional?: boolean;
}

export interface OnboardingConfig {
  key: string;
  title: string;
  steps: OnboardingStep[];
}

export const OnboardingChecklist = ({ 
  config 
}: { 
  config: OnboardingConfig 
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const { user } = useAuth();
  const { tenantId } = useTenant();

  useEffect(() => {
    if (user && tenantId) {
      loadProgress();
    }
  }, [user, tenantId]);

  const loadProgress = async () => {
    const { data, error } = await supabase
      .from('user_onboarding_progress')
      .select('step_key')
      .eq('user_id', user?.id)
      .eq('tenant_id', tenantId);

    if (data) {
      setCompletedSteps(data.map(d => d.step_key));
    }
  };

  const toggleStep = async (stepKey: string) => {
    if (!user || !tenantId) return;

    if (completedSteps.includes(stepKey)) {
      await supabase
        .from('user_onboarding_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('step_key', stepKey);
      
      setCompletedSteps(prev => prev.filter(k => k !== stepKey));
    } else {
      await supabase
        .from('user_onboarding_progress')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          step_key: stepKey
        });
      
      setCompletedSteps(prev => [...prev, stepKey]);
      toast.success('Progresso salvo!');
    }
  };

  const progress = (completedSteps.length / config.steps.length) * 100;
  const isFinished = completedSteps.length === config.steps.length;

  if (isFinished && !isMinimized) return null;

  return (
    <div className={cn(
      "fixed bottom-8 right-8 z-[100] transition-all duration-500",
      isMinimized ? "w-16 h-16" : "w-full max-w-sm"
    )}>
      <AnimatePresence mode="wait">
        {isMinimized ? (
          <motion.button
            key="minimized"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setIsMinimized(false)}
            className="w-16 h-16 rounded-full bg-gold text-black shadow-[0_8px_32px_rgba(212,175,55,0.4)] flex items-center justify-center group"
          >
            <Rocket className="w-6 h-6 group-hover:animate-bounce" />
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-gold text-[10px] font-black grid place-items-center">
              {completedSteps.length}
            </div>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-[#0A1020] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-white/[0.02] border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 grid place-items-center">
                    <Rocket className="w-4 h-4 text-gold" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">
                    {config.title}
                  </h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8 text-white/20 hover:text-white"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                  <span>Seu Onboarding</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            </div>

            {/* Steps */}
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
              {config.steps.map((step) => {
                const isCompleted = completedSteps.includes(step.key);
                return (
                  <div 
                    key={step.key}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer group",
                      isCompleted 
                        ? "bg-emerald-500/5 border-emerald-500/10" 
                        : "bg-white/[0.02] border-white/5 hover:border-white/10"
                    )}
                    onClick={() => toggleStep(step.key)}
                  >
                    <div className="flex gap-4">
                      <div className="shrink-0 pt-0.5">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-white/10 group-hover:text-gold transition-colors" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className={cn(
                          "text-xs font-black uppercase tracking-tight",
                          isCompleted ? "text-white/40 line-through" : "text-white"
                        )}>
                          {step.title}
                        </h4>
                        <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
              <Button 
                variant="ghost" 
                className="w-full text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white"
                onClick={() => setIsMinimized(true)}
              >
                Continuar depois
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
