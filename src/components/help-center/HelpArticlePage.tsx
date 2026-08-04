import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, PlayCircle, FileText, ExternalLink, BookOpen, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpArticlePageProps {
  article: any;
  onBack: () => void;
}

export function HelpArticlePage({ article, onBack }: HelpArticlePageProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="text-zinc-400 hover:text-white -ml-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a base
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-gold/15 text-gold border-gold/30">
                {article.category?.name || "Geral"}
              </Badge>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Versão 2.0
              </span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight">
              {article.title}
            </h2>
            <p className="text-xl text-zinc-400 leading-relaxed">
              {article.description}
            </p>
          </div>

          {article.type === 'video' && (
             <div className="aspect-video rounded-3xl overflow-hidden border border-zinc-800 bg-black relative group">
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 group-hover:bg-zinc-900/30 transition-all">
                  <PlayCircle className="h-20 w-20 text-gold shadow-2xl" />
                </div>
             </div>
          )}

          <div className="bg-[#0b0f17] rounded-3xl p-8 border border-zinc-800 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white border-b border-zinc-800 pb-4">
              <BookOpen className="text-gold h-5 w-5" />
              Conteúdo do Guia
            </h3>
            <div className="text-zinc-300 whitespace-pre-line leading-relaxed text-lg">
              {article.long_description || article.description}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0b0f17] rounded-3xl p-6 border border-zinc-800 space-y-4">
            <h4 className="font-bold text-white uppercase text-xs tracking-widest">Informações</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Tempo estimado</span>
                <span className="text-white font-medium flex items-center gap-1"><Clock size={14} /> {article.estimated_time}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Dificuldade</span>
                <Badge variant="outline" className="border-zinc-800">{article.level}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Tipo</span>
                <span className="text-white font-medium capitalize">{article.type}</span>
              </div>
            </div>
          </div>

          {article.related_route && (
            <Button className="w-full h-14 rounded-2xl bg-gold text-black font-black text-lg shadow-[0_8px_32px_rgba(212,175,55,0.3)] hover:shadow-[0_12px_48px_rgba(212,175,55,0.4)] transition-all">
               Abrir no Barbex
            </Button>
          )}

          <div className="bg-gold/5 rounded-3xl p-6 border border-gold/20 space-y-4">
             <h4 className="font-bold text-gold uppercase text-xs tracking-widest">Checklist</h4>
             <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-zinc-300">
                  <CheckCircle2 className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                  <span>Configurações verificadas</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-zinc-300">
                  <CheckCircle2 className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                  <span>Módulo ativo</span>
                </li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
