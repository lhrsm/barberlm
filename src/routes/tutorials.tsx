import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HelpCenterLayout } from "@/components/help-center/HelpCenterLayout";
import { HelpSearch } from "@/components/help-center/HelpSearch";
import { HelpCategories } from "@/components/help-center/HelpCategories";
import { HelpArticleCard } from "@/components/help-center/HelpArticleCard";
import { HelpArticlePage } from "@/components/help-center/HelpArticlePage";
import { Loader2, BookOpen, Search as SearchIcon } from "lucide-react";
import { withModule } from "@/components/modules/withModule";

export const Route = createFileRoute("/tutorials")({
  component: withModule("tutorials", "Tutoriais", HelpCenterPage),
});

function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

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
    return articles.filter((a: any) => 
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.long_description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [articles, searchQuery]);

  return (
    <HelpCenterLayout>
      {!selectedArticle ? (
        <div className="space-y-12">
          {/* Hero & Search */}
          <div className="text-center space-y-8 py-8">
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic">
              Como podemos <span className="text-gold">ajudar?</span>
            </h2>
            <HelpSearch value={searchQuery} onChange={setSearchQuery} />
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Categorias</h3>
            <HelpCategories 
              categories={categories || []} 
              selectedId={selectedCategoryId} 
              onSelect={setSelectedCategoryId} 
            />
          </div>

          {/* Articles Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <BookOpen className="text-gold h-5 w-5" />
                {selectedCategoryId 
                  ? categories?.find(c => c.id === selectedCategoryId)?.name 
                  : "Todos os Artigos"}
              </h3>
              <span className="text-xs text-zinc-500">{filteredArticles.length} resultados</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-gold" />
                <p className="text-zinc-500 font-medium">Carregando base de conhecimento...</p>
              </div>
            ) : filteredArticles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredArticles.map((article) => (
                  <HelpArticleCard
                    key={article.id}
                    article={article}
                    onClick={setSelectedArticle}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-24 border-2 border-dashed rounded-3xl bg-[#0b0f17]/50 border-zinc-800">
                <SearchIcon className="h-16 w-16 text-zinc-700 mx-auto mb-4" />
                <h4 className="text-xl font-bold text-white">Nenhum resultado encontrado</h4>
                <p className="text-zinc-500 max-w-sm mx-auto mt-2">
                  Não encontramos artigos para "{searchQuery}". Tente termos mais genéricos ou navegue pelas categorias.
                </p>
              </div>
            )}
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
