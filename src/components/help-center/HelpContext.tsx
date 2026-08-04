import React from 'react';
import { HelpCircle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';

export interface ContextualTipProps {
  title: string;
  description: string;
  impact?: string;
  actionLabel?: string;
  actionHref?: string;
  tutorialHref?: string;
  variant?: 'info' | 'warning' | 'error';
}

export const ContextualTip = ({ 
  title, 
  description, 
  impact, 
  actionLabel, 
  actionHref,
  tutorialHref,
  variant = 'info' 
}: ContextualTipProps) => {
  const icons = {
    info: <Info className="w-4 h-4 text-blue-400" />,
    warning: <HelpCircle className="w-4 h-4 text-gold" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />
  };

  const bgColors = {
    info: 'bg-blue-500/5 border-blue-500/10',
    warning: 'bg-gold/5 border-gold/10',
    error: 'bg-red-500/5 border-red-500/10'
  };

  return (
    <div className={cn("p-4 rounded-2xl border flex gap-4 transition-all", bgColors[variant])}>
      <div className="shrink-0 pt-0.5">
        {icons[variant]}
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-black text-white uppercase italic tracking-tight">{title}</h4>
          <p className="text-xs text-white/50 font-medium leading-relaxed">{description}</p>
        </div>
        
        {impact && (
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none">
            Impacto: <span className="text-white/60">{impact}</span>
          </p>
        )}

        <div className="flex gap-4">
          {actionHref && (
            <Link 
              to={actionHref as any}
              className="text-[10px] font-black uppercase tracking-widest text-gold hover:text-gold/80 flex items-center gap-2"
            >
              {actionLabel || 'Resolver Agora'}
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}
          {tutorialHref && (
            <Link 
              to="/tutorials"
              className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white flex items-center gap-2"
            >
              Ver Tutorial
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export const HelpTooltip = ({ 
  content, 
  children 
}: { 
  content: string; 
  children: React.ReactNode 
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-white/20">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-[#0A1020] border-gold/20 text-white p-3 rounded-xl shadow-2xl">
          <p className="text-xs font-medium leading-relaxed text-white/80">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
  </svg>
);
