import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Lightbulb,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { Link } from '@tanstack/react-router';

export interface TourStep {
  target: string; // CSS Selector
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  actionLabel?: string;
  actionHref?: string;
  articleHref?: string;
}

export interface GuidedTourConfig {
  key: string;
  version: string;
  steps: TourStep[];
}

export const GuidedTour = ({ 
  config,
  onComplete
}: { 
  config: GuidedTourConfig;
  onComplete?: () => void;
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();
  const { tenantId } = useTenant();

  useEffect(() => {
    if (user && tenantId) {
      checkTourState();
    }
  }, [user, tenantId]);

  const checkTourState = async () => {
    const { data, error } = await supabase
      .from('user_tour_states')
      .select('*')
      .eq('user_id', user?.id)
      .eq('tenant_id', tenantId)
      .eq('tour_key', config.key)
      .single();

    if (!data || (data.status !== 'completed' && data.version !== config.version)) {
      setIsVisible(true);
      if (data?.last_step_index) setCurrentStepIndex(data.last_step_index);
    }
  };

  const updateTourState = async (status: 'in_progress' | 'completed' | 'skipped', stepIndex: number) => {
    if (!user || !tenantId) return;

    await supabase
      .from('user_tour_states')
      .upsert({
        user_id: user.id,
        tenant_id: tenantId,
        tour_key: config.key,
        status,
        version: config.version,
        last_step_index: stepIndex,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,tenant_id,tour_key' });
  };

  useEffect(() => {
    if (!isVisible) return;

    const updatePosition = () => {
      const step = config.steps[currentStepIndex];
      const element = document.querySelector(step.target);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [currentStepIndex, isVisible, config.steps]);

  const handleNext = () => {
    if (currentStepIndex < config.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      updateTourState('in_progress', nextIndex);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      updateTourState('in_progress', prevIndex);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    updateTourState('skipped', currentStepIndex);
  };

  const handleComplete = () => {
    setIsVisible(false);
    updateTourState('completed', currentStepIndex);
    if (onComplete) onComplete();
  };

  if (!isVisible || !targetRect) return null;

  const step = config.steps[currentStepIndex];
  
  // Calculate tooltip position based on targetRect and step.position
  const tooltipStyles: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
  };

  if (step.position === 'bottom') {
    tooltipStyles.top = targetRect.bottom + 12;
    tooltipStyles.left = targetRect.left + (targetRect.width / 2) - 160;
  } else if (step.position === 'top') {
    tooltipStyles.bottom = (window.innerHeight - targetRect.top) + 12;
    tooltipStyles.left = targetRect.left + (targetRect.width / 2) - 160;
  } else if (step.position === 'left') {
    tooltipStyles.right = (window.innerWidth - targetRect.left) + 12;
    tooltipStyles.top = targetRect.top + (targetRect.height / 2) - 100;
  } else if (step.position === 'right') {
    tooltipStyles.left = targetRect.right + 12;
    tooltipStyles.top = targetRect.top + (targetRect.height / 2) - 100;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-[2px] pointer-events-none" />
      
      {/* Spotlight Effect (simplified for demo, usually involves a SVG mask) */}
      <div 
        className="fixed z-[999] border-2 border-gold rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-300 pointer-events-none"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
        }}
      />

      {/* Tooltip */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-80 bg-[#0A1020] border border-gold/30 rounded-[24px] shadow-2xl overflow-hidden pointer-events-auto"
        style={tooltipStyles}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-gold" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gold">Passo {currentStepIndex + 1} de {config.steps.length}</span>
             </div>
             <button onClick={handleSkip} className="text-white/20 hover:text-white transition-colors">
               <X className="w-4 h-4" />
             </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">{step.title}</h3>
            <p className="text-xs text-white/50 font-medium leading-relaxed">{step.description}</p>
          </div>

          {step.articleHref && (
            <div className="pt-2">
              <Link to="/tutorials">
                <Button variant="ghost" className="h-auto p-0 text-[10px] font-black uppercase tracking-widest text-gold hover:text-gold/80 gap-2">
                  <BookOpen className="w-3 h-3" />
                  Ver tutorial completo
                </Button>
              </Link>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                className="h-8 border-white/10 bg-white/5 text-white disabled:opacity-20"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNext}
                className="h-8 border-white/10 bg-white/5 text-white"
              >
                {currentStepIndex === config.steps.length - 1 ? 'Finalizar' : <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSkip}
              className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white"
            >
              Pular tour
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
