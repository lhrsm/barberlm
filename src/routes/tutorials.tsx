import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  GraduationCap, 
  Search, 
  Star,
  BookOpen,
  PlayCircle,
  FileText,
  ExternalLink,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { TutorialCard } from "@/components/tutorials/TutorialCard";
import { VideoPlayer } from "@/components/tutorials/VideoPlayer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PremiumTabs,
  PremiumTabsList,
  PremiumTabsBody,
  PremiumTabsContent,
} from "@/components/ui/premium-tabs";
import { Rocket, Calendar, DollarSign, Zap, Crown, MessageCircle } from "lucide-react";
import { withModule } from "@/components/modules/withModule";

const MOBILE_TABS = [
  { value: "primeiros", label: "Primeiros Passos", icon: Rocket, keywords: ["primeiro", "começ", "intro", "inicio", "início"] },
  { value: "agendamentos", label: "Agendamentos", icon: Calendar, keywords: ["agendamento", "agenda"] },
  { value: "financeiro", label: "Financeiro", icon: DollarSign, keywords: ["financ", "pagamento", "caixa"] },
  { value: "automacoes", label: "Automações", icon: Zap, keywords: ["automa"] },
  { value: "assinaturas", label: "Assinaturas", icon: Crown, keywords: ["assinatur", "plano"] },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, keywords: ["whats"] },
];

function matchesTab(tutorial: any, tabValue: string) {
  const tab = MOBILE_TABS.find((t) => t.value === tabValue);
  if (!tab) return false;
  const name = (tutorial.category?.name || "").toLowerCase();
  const title = (tutorial.title || "").toLowerCase();
  return tab.keywords.some((k) => name.includes(k) || title.includes(k));
}

export const Route = createFileRoute("/tutorials")({
  component: withModule("tutorials", "Tutoriais", TutorialsPage),
});

function TutorialsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTutorial, setSelectedTutorial] = useState<any>(null);

  const { data: categories } = useQuery({
    queryKey: ["tutorial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_categories")
        .select("*")
        .order("order", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: tutorials, isLoading } = useQuery({
    queryKey: ["tutorials", selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from("tutorials")
        .select(`
          *,
          category:tutorial_categories(name)
        `)
        .order("order", { ascending: true });
      
      if (selectedCategory) {
        query = query.eq("category_id", selectedCategory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const filteredTutorials = tutorials?.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredTutorials = tutorials?.filter(t => t.is_featured);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                <GraduationCap className="h-7 w-7 text-[#f59e0b]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">
                  Tutoriais
                </h1>
                <p className="text-sm text-zinc-400 mt-1 truncate">
                  Domine a Barbex com nossos guias práticos e rápidos.
                </p>
              </div>
            </div>
          </header>

          {/* Featured Section */}
          {featuredTutorials && featuredTutorials.length > 0 && !selectedCategory && !searchQuery && (
            <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Star className="h-5 w-5 text-[#f59e0b] fill-[#f59e0b]" />
                Destaques
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredTutorials.slice(0, 3).map((tutorial) => (
                  <TutorialCard
                    key={tutorial.id}
                    tutorial={tutorial}
                    onClick={setSelectedTutorial}
                  />
                ))}
              </div>
            </div>
          )}

          {/* MOBILE — Premium tabs (Mercado Pago style) */}
          <div className="md:hidden">
            <PremiumTabs defaultValue="primeiros">
              <PremiumTabsList tabs={MOBILE_TABS} />
              <PremiumTabsBody>
                {MOBILE_TABS.map((tab) => {
                  const items = tutorials?.filter((t) => matchesTab(t, tab.value)) || [];
                  return (
                    <PremiumTabsContent key={tab.value} value={tab.value}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                          <tab.icon size={16} className="text-[#f59e0b]" />
                          {tab.label}
                        </h3>
                        <span className="text-xs text-zinc-400">{items.length} tutoriais</span>
                      </div>
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#f59e0b]" />
                          <p className="text-zinc-400 text-sm">Buscando conteúdo...</p>
                        </div>
                      ) : items.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {items.map((tutorial) => (
                            <TutorialCard
                              key={tutorial.id}
                              tutorial={tutorial}
                              onClick={setSelectedTutorial}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-[#05070d] border-zinc-800">
                          <BookOpen className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                          <h4 className="text-sm font-bold text-white">Nenhum tutorial nesta categoria</h4>
                          <p className="text-zinc-400 text-xs max-w-xs mx-auto mt-1">
                            Em breve novos conteúdos serão adicionados aqui.
                          </p>
                        </div>
                      )}
                    </PremiumTabsContent>
                  );
                })}
              </PremiumTabsBody>
            </PremiumTabs>
          </div>

          {/* DESKTOP — Filters & Search */}
          <div className="hidden md:flex bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5 flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
              <Input
                placeholder="Buscar por título ou descrição..."
                className="pl-10 h-[42px] rounded-xl bg-[#05070d] border-zinc-800 focus-visible:border-[#f59e0b]/40 focus-visible:ring-[#f59e0b]/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={`h-[42px] px-4 rounded-xl whitespace-nowrap transition-all ${
                  selectedCategory === null
                    ? "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
                    : "bg-transparent border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#f59e0b]/40"
                }`}
              >
                Todos
              </Button>
              {categories?.map((category) => (
                <Button
                  key={category.id}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`h-[42px] px-4 rounded-xl whitespace-nowrap transition-all ${
                    selectedCategory === category.id
                      ? "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
                      : "bg-transparent border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#f59e0b]/40"
                  }`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* DESKTOP — Tutorials Grid */}
          <div className="hidden md:block bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <BookOpen className="h-5 w-5 text-[#f59e0b]" />
                {selectedCategory ? categories?.find(c => c.id === selectedCategory)?.name : "Todos os Tutoriais"}
              </h3>
              <span className="text-xs text-zinc-400">{filteredTutorials?.length || 0} resultados</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-[#f59e0b]" />
                <p className="text-zinc-400">Buscando conteúdo...</p>
              </div>
            ) : filteredTutorials && filteredTutorials.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredTutorials.map((tutorial) => (
                  <TutorialCard
                    key={tutorial.id}
                    tutorial={tutorial}
                    onClick={setSelectedTutorial}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-[#05070d] border-zinc-800">
                <Search className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold">Nenhum tutorial encontrado</h4>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-2">
                  Tente ajustar sua busca ou filtro para encontrar o que precisa.
                </p>
              </div>
            )}
          </div>

          {/* Tutorial Modal */}
          <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
            <DialogContent className="max-w-4xl p-0 bg-[#0b0f17] border border-[#D4AF37]/40 text-white overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)]">
              {selectedTutorial && (
                <div className="flex flex-col h-[90vh] md:h-auto max-h-[90vh]">
                  <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                    <DialogHeader>
                      <div className="flex items-center gap-3 mb-4">
                        <Badge className="bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
                          {selectedTutorial.category?.name || "Geral"}
                        </Badge>
                        <Badge variant="outline" className="border-zinc-800 text-zinc-400">
                          {selectedTutorial.type === 'video' ? <PlayCircle size={10} className="mr-1" /> : <FileText size={10} className="mr-1" />}
                          {selectedTutorial.type.toUpperCase()}
                        </Badge>
                      </div>
                      <DialogTitle className="text-3xl font-bold tracking-tight mb-2">
                        {selectedTutorial.title}
                      </DialogTitle>
                      <DialogDescription className="text-zinc-400 text-base">
                        {selectedTutorial.description}
                      </DialogDescription>
                    </DialogHeader>

                    {selectedTutorial.type === 'video' && selectedTutorial.content_url ? (
                      <VideoPlayer url={selectedTutorial.content_url} thumbnail={selectedTutorial.thumbnail_url} />
                    ) : selectedTutorial.type === 'pdf' && selectedTutorial.content_url ? (
                      <div className="p-12 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-4 bg-[#05070d]">
                        <FileText size={64} className="text-[#f59e0b] opacity-60" />
                        <div className="text-center">
                          <p className="font-bold">Manual em PDF</p>
                          <p className="text-sm text-zinc-400">Este documento está disponível para download.</p>
                        </div>
                        <Button asChild className="h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all hover:-translate-y-0.5">
                          <a href={selectedTutorial.content_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={18} className="mr-2" /> Baixar Documento
                          </a>
                        </Button>
                      </div>
                    ) : selectedTutorial.type === 'link' && selectedTutorial.content_url ? (
                      <div className="p-12 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-4 bg-[#05070d]">
                        <ExternalLink size={64} className="text-[#f59e0b] opacity-60" />
                        <div className="text-center">
                          <p className="font-bold">Link Externo</p>
                          <p className="text-sm text-zinc-400">Clique no botão abaixo para acessar o conteúdo externo.</p>
                        </div>
                        <Button asChild className="h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all hover:-translate-y-0.5">
                          <a href={selectedTutorial.content_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={18} className="mr-2" /> Acessar Link
                          </a>
                        </Button>
                      </div>
                    ) : null}

                    <div className="bg-[#05070d] rounded-2xl p-6 border border-zinc-800">
                      <h5 className="font-bold mb-4 flex items-center gap-2 text-white">
                        <BookOpen className="text-[#f59e0b] h-4 w-4" />
                        Passo a passo
                      </h5>
                      <div className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
                        {selectedTutorial.long_description || selectedTutorial.description || "Nenhum detalhe adicional disponível."}
                      </div>
                      {selectedTutorial.estimated_time && (
                        <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-400">
                          <span>⏱ Tempo estimado: <span className="text-white font-semibold">{selectedTutorial.estimated_time}</span></span>
                          {selectedTutorial.level && (
                            <span>📚 Nível: <span className="text-white font-semibold capitalize">{selectedTutorial.level}</span></span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6 border-t border-zinc-800 flex justify-end bg-[#05070d]">
                    <Button onClick={() => setSelectedTutorial(null)} className="h-9 px-5 rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:bg-[#B8941F] hover:scale-105 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all duration-300">
                      Fechar
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppLayout>
  );
}
