import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HelpCenterLayout } from "@/components/help-center/HelpCenterLayout";
import { HelpSearch } from "@/components/help-center/HelpSearch";
import { HelpCategories } from "@/components/help-center/HelpCategories";
import { HelpArticleCard } from "@/components/help-center/HelpArticleCard";
import { HelpArticlePage } from "@/components/help-center/HelpArticlePage";
import { HelpHistory } from "@/components/help-center/HelpHistory";
import { HelpSkeleton } from "@/components/help-center/HelpSkeleton";
import { BookOpen, Search as SearchIcon } from "lucide-react";
import { withModule } from "@/components/modules/withModule";

export const Route = createFileRoute("/tutorials")({
  component: withModule("tutorials", "Tutoriais", HelpCenterPage),
});

function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [recentArticles, setRecentArticles] = useState<any[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('help_history');
    if (saved) {
      try {
        setRecentArticles(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing help history", e);
      }
    }
  }, []);

  const addToHistory = (article: any) => {
    const newHistory = [article, ...recentArticles.filter(a => a.id !== article.id)].slice(0, 5);
    setRecentArticles(newHistory);
    localStorage.setItem('help_history', JSON.stringify(newHistory));
    setSelectedArticle(article);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { data: categories } = useQuery({
    queryKey: ["help-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_categories")
        .select("*")
        .order("order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ["help-articles", selectedCategoryId],
    queryFn: async () => {
      let query = supabase
        .from("tutorials")
        .select(`
          *,
          category:tutorial_categories(name)
        `)
        .order("order", { ascending: true });
      
      if (selectedCategoryId) {
        query = query.eq("category_id", selectedCategoryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    const q = searchQuery.toLowerCase();
    return articles.filter((a: any) => 
      a.title.toLowerCase().includes(q) ||
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.long_description && a.long_description.toLowerCase().includes(q))
    );
  }, [articles, searchQuery]);

  return (
    <HelpCenterLayout>
      {!selectedArticle ? (
        <div className="space-y-12">
          {/* Hero & Search */}
          <div className="text-center space-y-8 py-8 md:py-16">
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic">
              Como podemos <span className="text-gold">ajudar?</span>
            </h2>
            <HelpSearch value={searchQuery} onChange={setSearchQuery} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-10">
              {/* Categories */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Categorias</h3>
                <HelpCategories 
                  categories={categories || []} 
                  selectedId={selectedCategoryId} 
                  onSelect={setSelectedCategoryId} 
                />
              </div>

              {/* Articles Grid */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <h3 className="font-bold flex items-center gap-2 text-white text-lg">
                    <BookOpen className="text-gold h-5 w-5" />
                    {selectedCategoryId 
                      ? categories?.find(c => c.id === selectedCategoryId)?.name 
                      : "Todos os Artigos"}
                  </h3>
                  <span className="text-xs text-zinc-500 font-medium">{filteredArticles.length} resultados</span>
                </div>

                {isLoading ? (
                  <HelpSkeleton />
                ) : filteredArticles.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredArticles.map((article) => (
                      <HelpArticleCard
                        key={article.id}
                        article={article}
                        onClick={addToHistory}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-24 border-2 border-dashed rounded-[40px] bg-[#0b0f17]/50 border-zinc-800 animate-in fade-in zoom-in-95 duration-500">
                    <SearchIcon className="h-16 w-16 text-zinc-700 mx-auto mb-4" />
                    <h4 className="text-xl font-bold text-white">Nenhum resultado encontrado</h4>
                    <p className="text-zinc-500 max-w-sm mx-auto mt-2">
                      Não encontramos artigos para "{searchQuery}". Tente termos mais genéricos ou navegue pelas categorias.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-6">
               <HelpHistory recentArticles={recentArticles} onSelect={addToHistory} />
               <div className="p-6 bg-gold rounded-3xl space-y-4 shadow-[0_8px_32px_rgba(212,175,55,0.2)]">
                  <h4 className="font-black text-black uppercase text-xs tracking-widest">Suporte Direto</h4>
                  <p className="text-sm text-black/70 font-medium">Não encontrou o que precisava? Fale com nosso time agora.</p>
                  <Button variant="outline" className="w-full bg-black/10 border-black/20 text-black hover:bg-black/20 font-bold rounded-xl" asChild>
                    <Link to="/support">Abrir Chamado</Link>
                  </Button>
               </div>
            </aside>
          </div>
        </div>
      ) : (
        <HelpArticlePage 
          article={selectedArticle} 
          onBack={() => setSelectedArticle(null)} 
        />
      )}
    </HelpCenterLayout>
  );
}

