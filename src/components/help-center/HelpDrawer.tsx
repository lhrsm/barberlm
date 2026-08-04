import React, { useState } from 'react';
import { 
  HelpCircle, 
  PlayCircle, 
  FileText, 
  MessageSquare, 
  ChevronRight, 
  ExternalLink,
  BookOpen,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

export interface HelpContextProps {
  moduleKey: string;
  routePath: string;
  title: string;
  summary: string;
  videoUrl?: string;
  tutorialId?: string;
  faqs?: Array<{ question: string; answer: string }>;
  commonIssues?: Array<{ issue: string; solution: string }>;
  relatedArticles?: Array<{ title: string; href: string }>;
}

export const HelpDrawer = ({ 
  config 
}: { 
  config: HelpContextProps 
}) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-2 text-white/40 hover:text-gold hover:bg-gold/10 font-bold uppercase tracking-widest text-[10px] transition-all"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Ajuda desta página
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-[#05080F] border-white/5 p-0">
        <SheetHeader className="p-6 border-b border-white/5 bg-white/[0.02]">
          <SheetTitle className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 grid place-items-center">
              <HelpCircle className="w-4 h-4 text-gold" />
            </div>
            Central de Ajuda
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-80px)] p-6">
          <div className="space-y-8 pb-12">
            {/* Header / Summary */}
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">
                {config.title}
              </h2>
              <p className="text-white/50 text-sm font-medium leading-relaxed">
                {config.summary}
              </p>
            </div>

            {/* Video Action */}
            {config.videoUrl && (
              <div className="group relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                <iframe 
                  src={config.videoUrl} 
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 gap-3">
              {config.tutorialId && (
                <Link to="/tutorials">
                  <Button className="w-full justify-between bg-gold text-black hover:bg-gold/80 font-black uppercase tracking-widest h-12 rounded-xl group px-6">
                    Abrir Tutorial
                    <PlayCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </Button>
                </Link>
              )}
              <Link to="/tutorials">
                <Button variant="outline" className="w-full justify-between border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest h-12 rounded-xl group px-6">
                  Ver Documentação
                  <FileText className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            {/* FAQs */}
            {config.faqs && config.faqs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gold uppercase tracking-[0.2em]">Dúvidas Frequentes</h3>
                <div className="space-y-2">
                  {config.faqs.map((faq, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                      <h4 className="text-sm font-black text-white uppercase tracking-tight italic">{faq.question}</h4>
                      <p className="text-xs text-white/40 font-medium leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common Issues */}
            {config.commonIssues && config.commonIssues.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-red-500 uppercase tracking-[0.2em]">Problemas Comuns</h3>
                <div className="space-y-2">
                  {config.commonIssues.map((issue, i) => (
                    <div key={i} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 space-y-2">
                      <h4 className="text-sm font-black text-red-400 uppercase tracking-tight italic">{issue.issue}</h4>
                      <p className="text-xs text-red-400/60 font-medium leading-relaxed">{issue.solution}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Articles */}
            {config.relatedArticles && config.relatedArticles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Artigos Relacionados</h3>
                <div className="space-y-2">
                  {config.relatedArticles.map((article, i) => (
                    <a 
                      key={i} 
                      href={article.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                    >
                      <span className="text-xs font-bold text-white/60 group-hover:text-white">{article.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-gold transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-6 border-t border-white/5">
              <Link to="/support">
                <Button variant="ghost" className="w-full text-white/20 hover:text-white text-[10px] font-black uppercase tracking-widest gap-2">
                  <MessageSquare className="w-3 h-3" />
                  Ainda com dúvidas? Fale com suporte
                </Button>
              </Link>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
