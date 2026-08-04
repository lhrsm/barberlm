import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Rocket, Sparkles, Wrench, ShieldCheck, Zap, Beaker, 
  AlertTriangle, Archive, Info, ChevronRight, Calendar,
  User, Tag, ArrowRight, ExternalLink, CheckCircle2, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

export const Route = createFileRoute("/updates")({
  component: UpdatesPage,
});

function UpdatesPage() {
  const { data: updates, isLoading } = useQuery({
    queryKey: ["public-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelog_entries")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feature': return <Rocket size={16} className="text-gold" />;
      case 'improvement': return <Sparkles size={16} className="text-blue-400" />;
      case 'fix': return <Wrench size={16} className="text-green-400" />;
      case 'security': return <ShieldCheck size={16} className="text-purple-400" />;
      case 'beta': return <Beaker size={16} className="text-yellow-400" />;
      case 'important': return <AlertTriangle size={16} className="text-rose-400" />;
      default: return <Zap size={16} className="text-zinc-400" />;
    }
  };

  const getTypeText = (type: string) => {
    const map: Record<string, string> = {
      feature: 'Nova Funcionalidade',
      improvement: 'Melhoria',
      fix: 'Correção',
      security: 'Segurança',
      beta: 'Beta',
      important: 'Importante',
      integration: 'Integração'
    };
    return map[type] || 'Atualização';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      <div className="relative h-64 md:h-80 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/10 via-zinc-950 to-zinc-950 z-0" />
        <div className="relative z-10 text-center space-y-4 px-4">
          <Badge className="bg-gold/20 text-gold border-gold/30 rounded-full px-4 py-1 font-black uppercase tracking-widest text-[10px] italic">
            Barbex Evolution
          </Badge>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic">
            Whats <span className="text-gold">New</span>
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto font-medium">
            Acompanhe a evolução da plataforma premium para barbearias. Novidades, correções e melhorias em tempo real.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-0 -mt-10 relative z-20">
        <Tabs defaultValue="all" className="space-y-8">
          <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-2xl w-full md:w-auto flex justify-center">
            <TabsTrigger value="all" className="rounded-xl px-8 font-bold data-[state=active]:bg-gold data-[state=active]:text-black">Tudo</TabsTrigger>
            <TabsTrigger value="features" className="rounded-xl px-8 font-bold data-[state=active]:bg-gold data-[state=active]:text-black">Novidades</TabsTrigger>
            <TabsTrigger value="fixes" className="rounded-xl px-8 font-bold data-[state=active]:bg-gold data-[state=active]:text-black">Correções</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-12">
            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="bg-zinc-900/40 border-white/5 animate-pulse h-64 rounded-3xl" />
                ))}
              </div>
            ) : updates?.length === 0 ? (
              <div className="text-center py-20 bg-zinc-900/20 rounded-3xl border border-dashed border-white/5">
                <Info size={40} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-bold uppercase italic">Nenhuma atualização registrada recentemente.</p>
              </div>
            ) : (
              updates?.map((update, idx) => (
                <motion.div
                  key={update.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <article className="group relative">
                    <div className="absolute -left-12 top-0 bottom-0 w-px bg-zinc-800 hidden md:block">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gold border-4 border-zinc-950" />
                    </div>

                    <Card className="bg-zinc-900/40 border-white/5 rounded-3xl overflow-hidden hover:border-gold/30 transition-all duration-500 backdrop-blur-sm">
                      {update.image_url && (
                        <div className="h-64 overflow-hidden">
                          <img src={update.image_url} alt={update.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
                        </div>
                      )}
                      <CardHeader className="p-8 pb-4">
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                          <Badge className="bg-zinc-800 text-zinc-400 border-white/5 rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-tighter flex items-center gap-2">
                            {getTypeIcon(update.type)}
                            {getTypeText(update.type)}
                          </Badge>
                          {update.version_tag && (
                            <Badge variant="outline" className="border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest italic rounded-lg">
                              v{update.version_tag}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase ml-auto">
                            <Calendar size={12} />
                            {update.published_at ? format(new Date(update.published_at), "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Recentemente'}
                          </div>
                        </div>
                        <CardTitle className="text-3xl font-black uppercase italic tracking-tighter text-white group-hover:text-gold transition-colors">
                          {update.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 pt-0 space-y-6">
                        <p className="text-zinc-400 leading-relaxed font-medium">
                          {update.summary || update.description?.substring(0, 200)}
                        </p>
                        
                        {update.description && update.description.length > 200 && (
                          <div className="prose prose-invert prose-zinc max-w-none text-zinc-500 text-sm" dangerouslySetInnerHTML={{ __html: update.description }} />
                        )}

                        {update.requires_action && (
                          <div className="bg-gold/5 border border-gold/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center text-gold">
                                <AlertTriangle size={24} />
                              </div>
                              <div>
                                <h4 className="font-black uppercase italic text-gold text-sm tracking-tighter">Ação Necessária</h4>
                                <p className="text-zinc-400 text-xs">Esta atualização requer uma configuração manual.</p>
                              </div>
                            </div>
                            <Button variant="gold" className="rounded-xl font-black px-6">
                              {update.action_label || 'Configurar Agora'}
                            </Button>
                          </div>
                        )}

                        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                          <div className="flex gap-2">
                            {update.is_beta && <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/20 font-black italic uppercase text-[9px]">Beta</Badge>}
                          </div>
                          <Button variant="ghost" className="text-zinc-500 hover:text-gold hover:bg-gold/10 rounded-xl group/btn">
                            Ver detalhes <ArrowRight size={16} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </article>
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
