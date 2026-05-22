import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  GraduationCap, 
  Search, 
  Filter, 
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

export const Route = createFileRoute("/tutorials")({
  component: TutorialsPage,
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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Tutoriais</h2>
            </div>
            <p className="text-muted-foreground">Domine a Barbex com nossos guias práticos e rápidos.</p>
          </div>
        </div>

        {/* Featured Section */}
        {featuredTutorials && featuredTutorials.length > 0 && !selectedCategory && !searchQuery && (
          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
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

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Buscar por título ou descrição..." 
              className="pl-10 h-11 bg-black/20 border-white/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            <Button 
              variant={selectedCategory === null ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="rounded-full h-11 px-6 whitespace-nowrap"
            >
              Todos
            </Button>
            {categories?.map((category) => (
              <Button 
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"} 
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full h-11 px-6 whitespace-nowrap"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Tutorials Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {selectedCategory ? categories?.find(c => c.id === selectedCategory)?.name : "Todos os Tutoriais"}
            </h3>
            <span className="text-xs text-muted-foreground">{filteredTutorials?.length || 0} resultados</span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Buscando conteúdo...</p>
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
            <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-white/[0.02] border-white/10">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h4 className="text-lg font-bold">Nenhum tutorial encontrado</h4>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                Tente ajustar sua busca ou filtro para encontrar o que precisa.
              </p>
            </div>
          )}
        </div>

        {/* Tutorial Modal */}
        <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
          <DialogContent className="max-w-4xl p-0 bg-black/95 border-white/10 text-white overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            {selectedTutorial && (
              <div className="flex flex-col h-[90vh] md:h-auto max-h-[90vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                  <DialogHeader>
                    <div className="flex items-center gap-3 mb-4">
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                        {selectedTutorial.category?.name || "Geral"}
                      </Badge>
                      <Badge variant="outline" className="border-white/10 text-gray-400">
                        {selectedTutorial.type === 'video' ? <PlayCircle size={10} className="mr-1" /> : <FileText size={10} className="mr-1" />}
                        {selectedTutorial.type.toUpperCase()}
                      </Badge>
                    </div>
                    <DialogTitle className="text-3xl font-bold tracking-tight mb-2">
                      {selectedTutorial.title}
                    </DialogTitle>
                    <DialogDescription className="text-gray-400 text-base">
                      {selectedTutorial.description}
                    </DialogDescription>
                  </DialogHeader>

                  {selectedTutorial.type === 'video' ? (
                    <VideoPlayer url={selectedTutorial.content_url} thumbnail={selectedTutorial.thumbnail_url} />
                  ) : selectedTutorial.type === 'pdf' ? (
                    <div className="p-12 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 bg-white/5">
                      <FileText size={64} className="text-purple-400 opacity-40" />
                      <div className="text-center">
                        <p className="font-bold">Manual em PDF</p>
                        <p className="text-sm text-gray-400">Este documento está disponível para download.</p>
                      </div>
                      <Button asChild className="mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 transition-transform">
                        <a href={selectedTutorial.content_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={18} className="mr-2" /> Baixar Documento
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div className="p-12 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 bg-white/5">
                      <ExternalLink size={64} className="text-purple-400 opacity-40" />
                      <div className="text-center">
                        <p className="font-bold">Link Externo</p>
                        <p className="text-sm text-gray-400">Clique no botão abaixo para acessar o conteúdo externo.</p>
                      </div>
                      <Button asChild className="mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 transition-transform">
                        <a href={selectedTutorial.content_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={18} className="mr-2" /> Acessar Link
                        </a>
                      </Button>
                    </div>
                  )}

                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h5 className="font-bold mb-4 flex items-center gap-2">
                      <PlayCircle className="text-purple-400 h-4 w-4" />
                      Resumo do Tutorial
                    </h5>
                    <div className="prose prose-invert prose-sm max-w-none text-gray-400">
                      {selectedTutorial.long_description || selectedTutorial.description || "Nenhum detalhe adicional disponível."}
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t border-white/10 flex justify-end bg-black">
                  <Button variant="ghost" onClick={() => setSelectedTutorial(null)} className="text-gray-400 hover:text-white">
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
