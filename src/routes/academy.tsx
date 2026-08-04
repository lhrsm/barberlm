import { createFileRoute } from "@tanstack/react-router";
import { AcademyLayout } from "@/components/academy/AcademyLayout";
import { AcademyPathCard } from "@/components/academy/AcademyComponents";
import { useQuery } from "@tanstack/react-query";
import { getAcademyPaths, getRecommendedPaths } from "@/lib/academy.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, Sparkles, Trophy, BookOpen } from "lucide-react";

export const Route = createFileRoute("/academy")({
  component: AcademyDashboard,
});

function AcademyDashboard() {
  const paths = useQuery({
    queryKey: ["academy-paths"],
    queryFn: () => getAcademyPaths({ data: {} })
  });

  const recommendations = useQuery({
    queryKey: ["academy-recommended"],
    queryFn: () => getRecommendedPaths({ data: {} })
  });

  return (
    <AcademyLayout>
      <div className="space-y-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-gold/20 via-[#0A1020] to-transparent border border-white/5 p-8 md:p-16">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 blur-[100px] rounded-full -mr-20 -mt-20" />
          
          <div className="max-w-2xl relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-black uppercase tracking-widest">
              <GraduationCap className="w-4 h-4" />
              Academia Barbex
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
              Evolua sua <span className="text-gold">carreira</span> e sua <span className="text-gold">gestão</span>
            </h1>
            
            <p className="text-white/50 text-lg font-medium leading-relaxed">
              Trilhas de aprendizado personalizadas para cada perfil da barbearia. 
              Do básico ao avançado, domine o ecossistema Barbex.
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                  <Trophy className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">Certificados</div>
                  <div className="text-[10px] font-bold text-white/30 uppercase">Em breve</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                  <BookOpen className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">Conteúdo Prático</div>
                  <div className="text-[10px] font-bold text-white/30 uppercase">Atualizado Semanalmente</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.data?.items && recommendations.data.items.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white/60">Recomendado para você</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.data.items.map((path: any) => (
                <AcademyPathCard key={path.id} path={path} progress={15} />
              ))}
            </div>
          </div>
        )}

        {/* All Paths */}
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Trilhas de Aprendizagem</h2>
              <p className="text-white/40 text-sm font-medium">Explore todos os módulos disponíveis para sua capacitação.</p>
            </div>
          </div>

          {paths.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-80 rounded-[32px] bg-white/5" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paths.data?.items?.map((path: any) => (
                <AcademyPathCard key={path.id} path={path} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AcademyLayout>
  );
}
